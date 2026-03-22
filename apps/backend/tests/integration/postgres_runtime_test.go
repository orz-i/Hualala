package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/project"
	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/runtime"
	_ "github.com/lib/pq"
)

func TestOpenStoreReturnsNativePostgresRuntime(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, "native-runtime")
	defer closeFn()

	if _, ok := runtimeStore.(*db.MemoryStore); ok {
		t.Fatalf("expected postgres runtime store not to expose *db.MemoryStore")
	}
}

func TestPostgresPublisherReplaysDurableEventsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "durable-events"
	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
	publisher := runtimeStore.Publisher()
	projectID := runtimeStore.GenerateProjectID()
	if err := runtimeStore.SaveProject(context.Background(), project.Project{
		ID:                   projectID,
		OrganizationID:       db.DefaultDevOrganizationID,
		OwnerUserID:          db.DefaultDevUserID,
		Title:                "Durable Event Project",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            publishedAt(),
		UpdatedAt:            publishedAt(),
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	published := publisher.Publish(events.Event{
		EventType:      "workflow.updated",
		OrganizationID: db.DefaultDevOrganizationID,
		ProjectID:      projectID,
		ResourceType:   "workflow_run",
		ResourceID:     "workflow-run-durable-1",
		Payload:        `{"status":"running"}`,
	})
	closeFn()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	defer reloadCloseFn()

	reloadedPublisher := reloadedStore.Publisher()
	reloadedPublisher.Publish(events.Event{
		EventType:      "asset.import_batch.updated",
		OrganizationID: db.DefaultDevOrganizationID,
		ProjectID:      projectID,
		ResourceType:   "import_batch",
		ResourceID:     "import-batch-durable-2",
		Payload:        `{"status":"confirmed"}`,
	})

	replayed := reloadedPublisher.List(db.DefaultDevOrganizationID, projectID, "")
	if len(replayed) != 2 {
		t.Fatalf("expected 2 durable events after reopen and republish, got %d", len(replayed))
	}
	if got := replayed[0].ID; got != published.ID {
		t.Fatalf("expected replayed event id %q, got %q", published.ID, got)
	}
	if got := replayed[0].EventType; got != "workflow.updated" {
		t.Fatalf("expected workflow.updated replay, got %q", got)
	}

	tail := reloadedPublisher.List(db.DefaultDevOrganizationID, projectID, published.ID)
	if len(tail) != 1 {
		t.Fatalf("expected 1 replayed event after cursor, got %d", len(tail))
	}
	if got := tail[0].EventType; got != "asset.import_batch.updated" {
		t.Fatalf("expected asset.import_batch.updated after cursor, got %q", got)
	}
}

func TestPostgresGatewayResultsPersistConcurrentKeys(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, "gateway-results")
	defer closeFn()

	const workerCount = 12
	start := make(chan struct{})
	var wg sync.WaitGroup
	errCh := make(chan error, workerCount)

	for i := range workerCount {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			<-start
			key := fmt.Sprintf("idem-%02d", index)
			errCh <- runtimeStore.SaveGatewayResult(context.Background(), key, gateway.GatewayResult{
				Provider:          "seedance",
				ExternalRequestID: fmt.Sprintf("external-%02d", index),
			})
		}(i)
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("SaveGatewayResult returned error: %v", err)
		}
	}
	for i := range workerCount {
		key := fmt.Sprintf("idem-%02d", i)
		record, ok := runtimeStore.GetGatewayResult(key)
		if !ok {
			t.Fatalf("expected gateway result for %s", key)
		}
		if record.ExternalRequestID != fmt.Sprintf("external-%02d", i) {
			t.Fatalf("expected external id for %s to persist, got %q", key, record.ExternalRequestID)
		}
	}
}

func TestExpiredUploadSessionRetryPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-retry"
	resetNativeIntegrationRuntimeStore(t)
	doUploadRequest := func(t *testing.T, client *http.Client, method string, url string, body string) map[string]any {
		t.Helper()

		var requestBody io.Reader
		if body != "" {
			requestBody = strings.NewReader(body)
		}
		request, err := http.NewRequest(method, url, requestBody)
		if err != nil {
			t.Fatalf("http.NewRequest %s %s returned error: %v", method, url, err)
		}
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		request.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

		response, err := client.Do(request)
		if err != nil {
			t.Fatalf("%s %s returned error: %v", method, url, err)
		}
		defer response.Body.Close()

		responseBody, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatalf("io.ReadAll %s %s returned error: %v", method, url, err)
		}
		if response.StatusCode != http.StatusOK {
			t.Fatalf("%s %s returned status %d with body %s", method, url, response.StatusCode, string(responseBody))
		}

		var payload map[string]any
		if err := json.Unmarshal(responseBody, &payload); err != nil {
			t.Fatalf("json.Unmarshal %s %s returned error: %v", method, url, err)
		}
		return payload
	}

	var sessionID string

	t.Run("create and retry expired session", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		defer closeFn()

		services := runtime.NewFactory(runtimeStore).Services()
		projectRecord, err := services.ProjectService.CreateProject(context.Background(), projectapp.CreateProjectInput{
			OrganizationID:          db.DefaultDevOrganizationID,
			OwnerUserID:             db.DefaultDevUserID,
			Title:                   "Retry Upload Project",
			PrimaryContentLocale:    "zh-CN",
			SupportedContentLocales: []string{"zh-CN"},
		})
		if err != nil {
			t.Fatalf("CreateProject returned error: %v", err)
		}

		mux := http.NewServeMux()
		connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(services))
		server := httptest.NewServer(mux)
		defer server.Close()

		createPayload := `{"organization_id":"` + projectRecord.OrganizationID + `","project_id":"` + projectRecord.ID + `","file_name":"shot.png","checksum":"sha256:abc123","size_bytes":1024,"expires_in_seconds":0}`
		created := doUploadRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", createPayload)
		sessionID = created["session_id"].(string)

		retried := doUploadRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/retry", "")
		if got := retried["status"].(string); got != "pending" {
			t.Fatalf("expected retry response status pending, got %q", got)
		}
	})

	t.Run("verify session persists after reopen", func(t *testing.T) {
		if sessionID == "" {
			t.Fatal("expected sessionID from create-and-retry stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		defer reloadCloseFn()

		record, ok := reloadedStore.GetUploadSession(sessionID)
		if !ok {
			t.Fatalf("expected upload session %q after reopen", sessionID)
		}
		if got := record.Status; got != "pending" {
			t.Fatalf("expected reopened upload session status pending, got %q", got)
		}
		if got := record.RetryCount; got != 1 {
			t.Fatalf("expected reopened upload session retry_count 1, got %d", got)
		}
		if !record.ExpiresAt.After(time.Now().UTC()) {
			t.Fatalf("expected reopened upload session to keep future expiry, got %s", record.ExpiresAt.Format(time.RFC3339))
		}
	})
}

func publishedAt() time.Time {
	return time.Now().UTC()
}

func resetNativeIntegrationRuntimeStore(t *testing.T) {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	resetIntegrationRuntimeState(t, migrationsDir)
}

func openNativeIntegrationRuntimeStore(t *testing.T, suffix string) (db.RuntimeStore, func()) {
	t.Helper()

	cfg := config.Load()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	runtimeStore, closeFn, err := db.OpenStore(context.Background(), db.OpenStoreOptions{
		Driver:        cfg.DBDriver,
		DatabaseURL:   cfg.DatabaseURL,
		AutoMigrate:   cfg.AutoMigrate,
		MigrationsDir: migrationsDir,
		StoreKey:      fmt.Sprintf("integration-%s-%s", t.Name(), suffix),
	})
	if err != nil {
		t.Fatalf("OpenStore returned error: %v", err)
	}

	return runtimeStore, func() {
		if closeFn != nil {
			if err := closeFn(); err != nil {
				t.Fatalf("closeFn returned error: %v", err)
			}
		}
	}
}
