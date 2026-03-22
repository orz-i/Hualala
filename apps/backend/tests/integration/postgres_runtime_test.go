package integration

import (
	"bytes"
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

	connectrpc "connectrpc.com/connect"
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	assetdomain "github.com/hualala/apps/backend/internal/domain/asset"
	contentdomain "github.com/hualala/apps/backend/internal/domain/content"
	executiondomain "github.com/hualala/apps/backend/internal/domain/execution"
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

const (
	integrationSSEReplayTimeout       = 5 * time.Second
	shotWorkbenchBudgetLimitCents     = 500
	shotWorkbenchEstimatedCostCents   = 120
	shotWorkbenchRemainingBudgetCents = shotWorkbenchBudgetLimitCents - shotWorkbenchEstimatedCostCents
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

func TestExpiredUploadSessionRetryCompletePersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-retry-complete"
	resetNativeIntegrationRuntimeStore(t)

	var projectRecord project.Project
	var importBatch assetdomain.ImportBatch
	var sessionID string
	var lastEventID string

	t.Run("create retry and complete session", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		projectRecord = createUploadIntegrationProject(t, services, "Retry Complete Upload Project")
		importBatch = seedUploadIntegrationImportBatch(t, runtimeStore, projectRecord)

		created := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", map[string]any{
			"organization_id":    projectRecord.OrganizationID,
			"project_id":         projectRecord.ID,
			"import_batch_id":    importBatch.ID,
			"file_name":          "shot.png",
			"checksum":           "sha256:complete123",
			"size_bytes":         2048,
			"expires_in_seconds": 0,
		})
		sessionID = created["session_id"].(string)

		createEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
		if len(createEvents) != 2 {
			t.Fatalf("expected 2 create events after upload session creation, got %d", len(createEvents))
		}
		lastEventID = createEvents[len(createEvents)-1].ID

		retried := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/retry", nil)
		if got := retried["status"].(string); got != "pending" {
			t.Fatalf("expected retried upload session status pending, got %q", got)
		}
		if got := retried["retry_count"].(float64); got != 1 {
			t.Fatalf("expected retried upload session retry_count 1, got %.0f", got)
		}

		completed := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/complete", map[string]any{
			"variant_type":  "original",
			"mime_type":     "image/png",
			"locale":        "zh-CN",
			"rights_status": "clear",
			"ai_annotated":  true,
			"width":         1920,
			"height":        1080,
		})
		if got := completed["status"].(string); got != "uploaded" {
			t.Fatalf("expected completed upload session status uploaded, got %q", got)
		}
		if got := completed["retry_count"].(float64); got != 1 {
			t.Fatalf("expected completed upload session retry_count 1, got %.0f", got)
		}
		if got := completed["asset_id"].(string); got == "" {
			t.Fatal("expected asset_id in upload complete response, got empty")
		}
		if got := completed["upload_file_id"].(string); got == "" {
			t.Fatal("expected upload_file_id in upload complete response, got empty")
		}
		if got := completed["variant_id"].(string); got == "" {
			t.Fatal("expected variant_id in upload complete response, got empty")
		}
	})

	t.Run("verify persistence after reopen", func(t *testing.T) {
		if sessionID == "" {
			t.Fatal("expected sessionID from create-retry-complete stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		reopened := performUploadSessionRequest(t, reloadedServer.Client(), http.MethodGet, reloadedServer.URL+"/upload/sessions/"+sessionID, nil)
		if got := reopened["session_id"].(string); got != sessionID {
			t.Fatalf("expected reopened upload session_id %q, got %q", sessionID, got)
		}
		if got := reopened["status"].(string); got != "uploaded" {
			t.Fatalf("expected reopened upload session status uploaded, got %q", got)
		}
		if got := reopened["retry_count"].(float64); got != 1 {
			t.Fatalf("expected reopened upload session retry_count 1, got %.0f", got)
		}
		reopenedAssetID := reopened["asset_id"].(string)
		if reopenedAssetID == "" {
			t.Fatal("expected reopened upload session asset_id, got empty")
		}
		reopenedUploadFileID := reopened["upload_file_id"].(string)
		if reopenedUploadFileID == "" {
			t.Fatal("expected reopened upload session upload_file_id, got empty")
		}
		reopenedVariantID := reopened["variant_id"].(string)
		if reopenedVariantID == "" {
			t.Fatal("expected reopened upload session variant_id, got empty")
		}

		record, ok := reloadedStore.GetUploadSession(sessionID)
		if !ok {
			t.Fatalf("expected upload session %q after reopen", sessionID)
		}
		if got := record.Status; got != "uploaded" {
			t.Fatalf("expected stored upload session status uploaded after reopen, got %q", got)
		}
		if got := record.RetryCount; got != 1 {
			t.Fatalf("expected stored upload session retry_count 1 after reopen, got %d", got)
		}

		uploadFiles := reloadedStore.ListUploadFilesBySessionIDs([]string{sessionID})
		if len(uploadFiles) != 1 {
			t.Fatalf("expected 1 upload file after reopen, got %d", len(uploadFiles))
		}
		if got := uploadFiles[0].ID; got != reopenedUploadFileID {
			t.Fatalf("expected upload file id %q after reopen, got %q", reopenedUploadFileID, got)
		}

		mediaAssets := reloadedStore.ListMediaAssetsByImportBatch(importBatch.ID)
		if len(mediaAssets) != 1 {
			t.Fatalf("expected 1 media asset after reopen, got %d", len(mediaAssets))
		}
		if got := mediaAssets[0].ID; got != reopenedAssetID {
			t.Fatalf("expected media asset id %q after reopen, got %q", reopenedAssetID, got)
		}

		variants := reloadedStore.ListMediaAssetVariantsByUploadFileIDs([]string{uploadFiles[0].ID})
		if len(variants) != 1 {
			t.Fatalf("expected 1 media asset variant after reopen, got %d", len(variants))
		}
		if got := variants[0].ID; got != reopenedVariantID {
			t.Fatalf("expected media asset variant id %q after reopen, got %q", reopenedVariantID, got)
		}

		items := reloadedStore.ListImportBatchItems(importBatch.ID)
		if len(items) != 1 {
			t.Fatalf("expected 1 import batch item after reopen, got %d", len(items))
		}
		if got := items[0].Status; got != "uploaded_pending_match" {
			t.Fatalf("expected import batch item status uploaded_pending_match after reopen, got %q", got)
		}
		if got := items[0].AssetID; got != reopenedAssetID {
			t.Fatalf("expected import batch item asset_id %q after reopen, got %q", reopenedAssetID, got)
		}

		batch, ok := reloadedStore.GetImportBatch(importBatch.ID)
		if !ok {
			t.Fatalf("expected import batch %q after reopen", importBatch.ID)
		}
		if got := batch.Status; got != "uploaded_pending_match" {
			t.Fatalf("expected import batch status uploaded_pending_match after reopen, got %q", got)
		}
	})

	t.Run("verify SSE replay after reopen", func(t *testing.T) {
		if sessionID == "" || lastEventID == "" {
			t.Fatal("expected sessionID and lastEventID from create-retry-complete stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		replayedStream := readUploadReplayStream(t, reloadedServer, projectRecord.OrganizationID, projectRecord.ID, lastEventID, integrationSSEReplayTimeout,
			"event: asset.upload_session.updated",
			`"session_id":"`+sessionID+`"`,
			`"status":"uploaded"`,
			`"retry_count":1`,
			"event: asset.import_batch.updated",
			`"reason":"upload_session.completed"`,
			`"upload_session_id":"`+sessionID+`"`,
		)
		if !strings.Contains(replayedStream, "event: asset.upload_session.updated") {
			t.Fatalf("expected asset.upload_session.updated in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, `"reason":"upload_session.completed"`) {
			t.Fatalf("expected upload_session.completed replay payload, got %q", replayedStream)
		}
	})
}

func TestUploadSessionCompleteWithShotExecutionPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-complete-shot-execution"
	resetNativeIntegrationRuntimeStore(t)

	var projectRecord project.Project
	var importBatch assetdomain.ImportBatch
	var shotExecution executiondomain.ShotExecution
	var sessionID string
	var lastEventID string

	t.Run("create and complete shot execution upload session", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		projectRecord = createUploadIntegrationProject(t, services, "Shot Execution Upload Project")
		importBatch = seedUploadIntegrationImportBatch(t, runtimeStore, projectRecord)
		shotExecution = seedUploadIntegrationShotExecution(t, runtimeStore, projectRecord)

		created := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", map[string]any{
			"organization_id":    projectRecord.OrganizationID,
			"project_id":         projectRecord.ID,
			"import_batch_id":    importBatch.ID,
			"file_name":          "candidate-shot.png",
			"checksum":           "sha256:candidate123",
			"size_bytes":         4096,
			"expires_in_seconds": 60,
		})
		sessionID = created["session_id"].(string)

		createEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
		if len(createEvents) != 2 {
			t.Fatalf("expected 2 create events after upload session creation, got %d", len(createEvents))
		}
		lastEventID = createEvents[len(createEvents)-1].ID

		completed := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/complete", map[string]any{
			"shot_execution_id": shotExecution.ID,
			"variant_type":      "original",
			"mime_type":         "image/png",
			"locale":            "zh-CN",
			"rights_status":     "clear",
			"ai_annotated":      true,
			"width":             1920,
			"height":            1080,
		})
		if got := completed["status"].(string); got != "uploaded" {
			t.Fatalf("expected completed upload session status uploaded, got %q", got)
		}
		if got := completed["retry_count"].(float64); got != 0 {
			t.Fatalf("expected completed upload session retry_count 0, got %.0f", got)
		}
		if got := completed["asset_id"].(string); got == "" {
			t.Fatal("expected asset_id in candidate attach response, got empty")
		}
		if got := completed["upload_file_id"].(string); got == "" {
			t.Fatal("expected upload_file_id in candidate attach response, got empty")
		}
		if got := completed["variant_id"].(string); got == "" {
			t.Fatal("expected variant_id in candidate attach response, got empty")
		}
		if got := completed["candidate_asset_id"].(string); got == "" {
			t.Fatal("expected candidate_asset_id in candidate attach response, got empty")
		}
		if got := completed["shot_execution_id"].(string); got != shotExecution.ID {
			t.Fatalf("expected shot_execution_id %q, got %q", shotExecution.ID, got)
		}
	})

	t.Run("verify persistence after reopen", func(t *testing.T) {
		if sessionID == "" {
			t.Fatal("expected sessionID from create-and-complete stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		reopened := performUploadSessionRequest(t, reloadedServer.Client(), http.MethodGet, reloadedServer.URL+"/upload/sessions/"+sessionID, nil)
		if got := reopened["session_id"].(string); got != sessionID {
			t.Fatalf("expected reopened upload session_id %q, got %q", sessionID, got)
		}
		if got := reopened["status"].(string); got != "uploaded" {
			t.Fatalf("expected reopened upload session status uploaded, got %q", got)
		}
		if got := reopened["retry_count"].(float64); got != 0 {
			t.Fatalf("expected reopened upload session retry_count 0, got %.0f", got)
		}
		reopenedAssetID := reopened["asset_id"].(string)
		if reopenedAssetID == "" {
			t.Fatal("expected reopened asset_id, got empty")
		}
		reopenedUploadFileID := reopened["upload_file_id"].(string)
		if reopenedUploadFileID == "" {
			t.Fatal("expected reopened upload_file_id, got empty")
		}
		reopenedVariantID := reopened["variant_id"].(string)
		if reopenedVariantID == "" {
			t.Fatal("expected reopened variant_id, got empty")
		}
		reopenedCandidateAssetID := reopened["candidate_asset_id"].(string)
		if reopenedCandidateAssetID == "" {
			t.Fatal("expected reopened candidate_asset_id, got empty")
		}
		if got := reopened["shot_execution_id"].(string); got != shotExecution.ID {
			t.Fatalf("expected reopened shot_execution_id %q, got %q", shotExecution.ID, got)
		}

		uploadFiles := reloadedStore.ListUploadFilesBySessionIDs([]string{sessionID})
		if len(uploadFiles) != 1 {
			t.Fatalf("expected 1 upload file after reopen, got %d", len(uploadFiles))
		}
		if got := uploadFiles[0].ID; got != reopenedUploadFileID {
			t.Fatalf("expected reopened upload_file_id %q, got %q", reopenedUploadFileID, got)
		}

		mediaAssets := reloadedStore.ListMediaAssetsByImportBatch(importBatch.ID)
		if len(mediaAssets) != 1 {
			t.Fatalf("expected 1 media asset after reopen, got %d", len(mediaAssets))
		}
		if got := mediaAssets[0].ID; got != reopenedAssetID {
			t.Fatalf("expected reopened asset_id %q, got %q", reopenedAssetID, got)
		}

		variants := reloadedStore.ListMediaAssetVariantsByUploadFileIDs([]string{uploadFiles[0].ID})
		if len(variants) != 1 {
			t.Fatalf("expected 1 media asset variant after reopen, got %d", len(variants))
		}
		if got := variants[0].ID; got != reopenedVariantID {
			t.Fatalf("expected reopened variant_id %q, got %q", reopenedVariantID, got)
		}

		candidates := reloadedStore.ListCandidateAssetsByExecution(shotExecution.ID)
		if len(candidates) != 1 {
			t.Fatalf("expected 1 candidate asset after reopen, got %d", len(candidates))
		}
		if got := candidates[0].ID; got != reopenedCandidateAssetID {
			t.Fatalf("expected reopened candidate_asset_id %q, got %q", reopenedCandidateAssetID, got)
		}
		if got := candidates[0].AssetID; got != reopenedAssetID {
			t.Fatalf("expected candidate asset to reference asset_id %q, got %q", reopenedAssetID, got)
		}

		reloadedShotExecution, ok := reloadedStore.GetShotExecution(shotExecution.ID)
		if !ok {
			t.Fatalf("expected shot execution %q after reopen", shotExecution.ID)
		}
		if got := reloadedShotExecution.Status; got != "candidate_ready" {
			t.Fatalf("expected shot execution status candidate_ready after reopen, got %q", got)
		}

		items := reloadedStore.ListImportBatchItems(importBatch.ID)
		if len(items) != 1 {
			t.Fatalf("expected 1 import batch item after reopen, got %d", len(items))
		}
		if got := items[0].Status; got != "matched_pending_confirm" {
			t.Fatalf("expected import batch item status matched_pending_confirm after reopen, got %q", got)
		}
		if got := items[0].MatchedShotID; got != shotExecution.ShotID {
			t.Fatalf("expected matched_shot_id %q after reopen, got %q", shotExecution.ShotID, got)
		}
		if got := items[0].AssetID; got != reopenedAssetID {
			t.Fatalf("expected import batch item asset_id %q after reopen, got %q", reopenedAssetID, got)
		}

		batch, ok := reloadedStore.GetImportBatch(importBatch.ID)
		if !ok {
			t.Fatalf("expected import batch %q after reopen", importBatch.ID)
		}
		if got := batch.Status; got != "matched_pending_confirm" {
			t.Fatalf("expected import batch status matched_pending_confirm after reopen, got %q", got)
		}
	})

	t.Run("verify SSE replay after reopen", func(t *testing.T) {
		if sessionID == "" || lastEventID == "" {
			t.Fatal("expected sessionID and lastEventID from create-and-complete stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		replayedStream := readUploadReplayStream(t, reloadedServer, projectRecord.OrganizationID, projectRecord.ID, lastEventID, integrationSSEReplayTimeout,
			"event: asset.upload_session.updated",
			`"session_id":"`+sessionID+`"`,
			`"status":"uploaded"`,
			"event: shot.execution.updated",
			`"shot_execution_id":"`+shotExecution.ID+`"`,
			`"status":"candidate_ready"`,
			"event: asset.import_batch.updated",
			`"status":"matched_pending_confirm"`,
			`"reason":"upload_session.completed"`,
			`"upload_session_id":"`+sessionID+`"`,
		)
		if !strings.Contains(replayedStream, "event: asset.import_batch.updated") {
			t.Fatalf("expected asset.import_batch.updated in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, "event: shot.execution.updated") {
			t.Fatalf("expected shot.execution.updated in replay stream, got %q", replayedStream)
		}
	})
}

func TestImportBatchWorkbenchCandidateReadyPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "import-workbench-candidate-ready"
	resetNativeIntegrationRuntimeStore(t)

	var scenario importWorkbenchExecutionScenario

	t.Run("create candidate_ready import workbench state", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedImportWorkbenchExecutionScenario(t, runtimeStore, server, services, "Import Workbench Candidate Ready", false)
	})

	if scenario.Project.ID == "" || scenario.ImportBatchID == "" || scenario.ShotExecutionID == "" {
		t.Fatal("expected seeded import workbench candidate_ready scenario")
	}

	verifyImportWorkbenchExecutionReopenState(t, storeKey, scenario, importWorkbenchExecutionExpectation{
		ExpectedStatus:         "candidate_ready",
		ExpectedPrimaryAssetID: "",
	})
}

func TestImportBatchWorkbenchPrimarySelectionPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "import-workbench-primary-selected"
	resetNativeIntegrationRuntimeStore(t)

	var scenario importWorkbenchExecutionScenario

	t.Run("create primary_selected import workbench state", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedImportWorkbenchExecutionScenario(t, runtimeStore, server, services, "Import Workbench Primary Selected", true)
	})

	if scenario.Project.ID == "" || scenario.ImportBatchID == "" || scenario.ShotExecutionID == "" || scenario.AssetID == "" {
		t.Fatal("expected seeded import workbench primary_selected scenario")
	}

	verifyImportWorkbenchExecutionReopenState(t, storeKey, scenario, importWorkbenchExecutionExpectation{
		ExpectedStatus:         "primary_selected",
		ExpectedPrimaryAssetID: scenario.AssetID,
	})
}

func TestImportWorkbenchExecutionReplayAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "import-workbench-execution-replay"
	resetNativeIntegrationRuntimeStore(t)

	var scenario importWorkbenchExecutionScenario

	t.Run("create import workbench execution transitions", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedImportWorkbenchExecutionScenario(t, runtimeStore, server, services, "Import Workbench Replay", true)
	})

	if scenario.Project.ID == "" || scenario.LastEventID == "" || scenario.AssetID == "" {
		t.Fatal("expected seeded import workbench replay scenario")
	}

	t.Run("verify replay after reopen", func(t *testing.T) {
		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		replayedStream := readUploadReplayStream(t, reloadedServer, scenario.Project.OrganizationID, scenario.Project.ID, scenario.LastEventID, integrationSSEReplayTimeout,
			"event: shot.execution.updated",
			`"shot_execution_id":"`+scenario.ShotExecutionID+`"`,
			`"status":"candidate_ready"`,
			`"candidate_asset_id":"`+scenario.CandidateAssetID+`"`,
			`"asset_id":"`+scenario.AssetID+`"`,
			`"status":"primary_selected"`,
			`"primary_asset_id":"`+scenario.AssetID+`"`,
		)
		if strings.Count(replayedStream, "event: shot.execution.updated") < 2 {
			t.Fatalf("expected at least 2 shot.execution.updated events in replay stream, got %q", replayedStream)
		}
	})
}

func TestShotWorkbenchReviewBudgetPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "shot-workbench-review-budget"
	resetNativeIntegrationRuntimeStore(t)

	var scenario shotWorkbenchPersistenceScenario

	t.Run("create single-run shot workbench state", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedShotWorkbenchPersistenceScenario(t, runtimeStore, server, services, "Shot Workbench Persistence Project")
	})

	if scenario.Project.ID == "" || scenario.Shot.ID == "" || scenario.ShotExecutionID == "" {
		t.Fatal("expected seeded shot workbench scenario")
	}

	openReopenedRuntime := func(t *testing.T) (db.RuntimeStore, *httptest.Server) {
		t.Helper()

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		t.Cleanup(closeUploadIntegrationResources(reloadedServer, reloadCloseFn))
		return reloadedStore, reloadedServer
	}

	t.Run("verify workbench query after reopen", func(t *testing.T) {
		_, reloadedServer := openReopenedRuntime(t)
		executionClient := executionv1connect.NewExecutionServiceClient(reloadedServer.Client(), reloadedServer.URL)

		workbench, err := executionClient.GetShotWorkbench(context.Background(), connectrpc.NewRequest(&executionv1.GetShotWorkbenchRequest{
			ShotId: scenario.Shot.ID,
		}))
		if err != nil {
			t.Fatalf("GetShotWorkbench returned error after reopen: %v", err)
		}
		if got := workbench.Msg.GetWorkbench().GetShotExecution().GetId(); got != scenario.ShotExecutionID {
			t.Fatalf("expected reopened shot_execution_id %q, got %q", scenario.ShotExecutionID, got)
		}
		if got := workbench.Msg.GetWorkbench().GetShotExecution().GetStatus(); got != "submitted_for_review" {
			t.Fatalf("expected reopened shot execution status submitted_for_review, got %q", got)
		}
		if got := workbench.Msg.GetWorkbench().GetShotExecution().GetPrimaryAssetId(); got != scenario.PrimaryAssetID {
			t.Fatalf("expected reopened primary_asset_id %q, got %q", scenario.PrimaryAssetID, got)
		}
		if len(workbench.Msg.GetWorkbench().GetCandidateAssets()) != 1 {
			t.Fatalf("expected 1 candidate asset after reopen, got %d", len(workbench.Msg.GetWorkbench().GetCandidateAssets()))
		}
		if got := workbench.Msg.GetWorkbench().GetCandidateAssets()[0].GetId(); got != scenario.CandidateAssetID {
			t.Fatalf("expected reopened candidate asset %q, got %q", scenario.CandidateAssetID, got)
		}
		if got := workbench.Msg.GetWorkbench().GetLatestEvaluationRun().GetStatus(); got != "passed" {
			t.Fatalf("expected reopened latest evaluation status passed, got %q", got)
		}
		if got := workbench.Msg.GetWorkbench().GetLatestEvaluationRun().GetId(); got != scenario.EvaluationRunID {
			t.Fatalf("expected reopened evaluation run %q, got %q", scenario.EvaluationRunID, got)
		}
		if got := workbench.Msg.GetWorkbench().GetReviewSummary().GetLatestConclusion(); got != "approved" {
			t.Fatalf("expected reopened latest review conclusion approved, got %q", got)
		}
		if got := workbench.Msg.GetWorkbench().GetReviewSummary().GetLatestReviewId(); got != scenario.ReviewID {
			t.Fatalf("expected reopened latest review id %q, got %q", scenario.ReviewID, got)
		}
	})

	t.Run("verify review queries after reopen", func(t *testing.T) {
		_, reloadedServer := openReopenedRuntime(t)
		reviewClient := reviewv1connect.NewReviewServiceClient(reloadedServer.Client(), reloadedServer.URL)

		evaluationRuns, err := reviewClient.ListEvaluationRuns(context.Background(), connectrpc.NewRequest(&reviewv1.ListEvaluationRunsRequest{
			ShotExecutionId: scenario.ShotExecutionID,
		}))
		if err != nil {
			t.Fatalf("ListEvaluationRuns returned error after reopen: %v", err)
		}
		if len(evaluationRuns.Msg.GetEvaluationRuns()) != 1 {
			t.Fatalf("expected 1 evaluation run after reopen, got %d", len(evaluationRuns.Msg.GetEvaluationRuns()))
		}
		if got := evaluationRuns.Msg.GetEvaluationRuns()[0].GetStatus(); got != "passed" {
			t.Fatalf("expected reopened evaluation run status passed, got %q", got)
		}

		shotReviews, err := reviewClient.ListShotReviews(context.Background(), connectrpc.NewRequest(&reviewv1.ListShotReviewsRequest{
			ShotExecutionId: scenario.ShotExecutionID,
		}))
		if err != nil {
			t.Fatalf("ListShotReviews returned error after reopen: %v", err)
		}
		if len(shotReviews.Msg.GetShotReviews()) != 1 {
			t.Fatalf("expected 1 shot review after reopen, got %d", len(shotReviews.Msg.GetShotReviews()))
		}
		if got := shotReviews.Msg.GetShotReviews()[0].GetConclusion(); got != "approved" {
			t.Fatalf("expected reopened review conclusion approved, got %q", got)
		}
	})

	t.Run("verify billing queries after reopen", func(t *testing.T) {
		_, reloadedServer := openReopenedRuntime(t)
		billingClient := billingv1connect.NewBillingServiceClient(reloadedServer.Client(), reloadedServer.URL)

		budgetSnapshot, err := billingClient.GetBudgetSnapshot(context.Background(), connectrpc.NewRequest(&billingv1.GetBudgetSnapshotRequest{
			ProjectId: scenario.Project.ID,
		}))
		if err != nil {
			t.Fatalf("GetBudgetSnapshot returned error after reopen: %v", err)
		}
		if got := budgetSnapshot.Msg.GetBudgetSnapshot().GetRemainingBudgetCents(); got != shotWorkbenchRemainingBudgetCents {
			t.Fatalf("expected reopened remaining budget %d, got %d", shotWorkbenchRemainingBudgetCents, got)
		}

		billingEvents, err := billingClient.ListBillingEvents(context.Background(), connectrpc.NewRequest(&billingv1.ListBillingEventsRequest{
			ProjectId: scenario.Project.ID,
		}))
		if err != nil {
			t.Fatalf("ListBillingEvents returned error after reopen: %v", err)
		}
		if len(billingEvents.Msg.GetBillingEvents()) != 1 {
			t.Fatalf("expected 1 billing event after reopen, got %d", len(billingEvents.Msg.GetBillingEvents()))
		}
		if got := billingEvents.Msg.GetBillingEvents()[0].GetEventType(); got != "execution_reserved" {
			t.Fatalf("expected reopened billing event execution_reserved, got %q", got)
		}
		if got := billingEvents.Msg.GetBillingEvents()[0].GetShotExecutionId(); got != scenario.ShotExecutionID {
			t.Fatalf("expected reopened billing shot_execution_id %q, got %q", scenario.ShotExecutionID, got)
		}
	})

	t.Run("verify direct store state after reopen", func(t *testing.T) {
		reloadedStore, _ := openReopenedRuntime(t)

		record, ok := reloadedStore.GetShotExecution(scenario.ShotExecutionID)
		if !ok {
			t.Fatalf("expected shot execution %q after reopen", scenario.ShotExecutionID)
		}
		if got := record.Status; got != "submitted_for_review" {
			t.Fatalf("expected stored shot execution status submitted_for_review, got %q", got)
		}
		if got := record.PrimaryAssetID; got != scenario.PrimaryAssetID {
			t.Fatalf("expected stored primary_asset_id %q, got %q", scenario.PrimaryAssetID, got)
		}
		if got := record.CurrentRunID; got != scenario.RunID {
			t.Fatalf("expected stored current_run_id %q, got %q", scenario.RunID, got)
		}

		runs := reloadedStore.ListShotExecutionRuns(scenario.ShotExecutionID)
		if len(runs) != 1 {
			t.Fatalf("expected 1 shot execution run after reopen, got %d", len(runs))
		}
		if got := runs[0].ID; got != scenario.RunID {
			t.Fatalf("expected stored run id %q, got %q", scenario.RunID, got)
		}

		candidates := reloadedStore.ListCandidateAssetsByExecution(scenario.ShotExecutionID)
		if len(candidates) != 1 {
			t.Fatalf("expected 1 stored candidate asset after reopen, got %d", len(candidates))
		}
		if got := candidates[0].ID; got != scenario.CandidateAssetID {
			t.Fatalf("expected stored candidate asset id %q, got %q", scenario.CandidateAssetID, got)
		}
		if got := candidates[0].AssetID; got != scenario.PrimaryAssetID {
			t.Fatalf("expected stored candidate asset media asset id %q, got %q", scenario.PrimaryAssetID, got)
		}

		storedEvaluations := reloadedStore.ListEvaluationRunsByExecution(scenario.ShotExecutionID)
		if len(storedEvaluations) != 1 {
			t.Fatalf("expected 1 stored evaluation run after reopen, got %d", len(storedEvaluations))
		}
		if got := storedEvaluations[0].ID; got != scenario.EvaluationRunID {
			t.Fatalf("expected stored evaluation run id %q, got %q", scenario.EvaluationRunID, got)
		}
		if got := storedEvaluations[0].Status; got != "passed" {
			t.Fatalf("expected stored evaluation status passed, got %q", got)
		}

		storedReviews := reloadedStore.ListReviewsByExecution(scenario.ShotExecutionID)
		if len(storedReviews) != 1 {
			t.Fatalf("expected 1 stored shot review after reopen, got %d", len(storedReviews))
		}
		if got := storedReviews[0].ID; got != scenario.ReviewID {
			t.Fatalf("expected stored review id %q, got %q", scenario.ReviewID, got)
		}
		if got := storedReviews[0].Conclusion; got != "approved" {
			t.Fatalf("expected stored review conclusion approved, got %q", got)
		}

		budgetRecord, ok := reloadedStore.GetBudgetByProject(scenario.Project.ID)
		if !ok {
			t.Fatalf("expected budget for project %q after reopen", scenario.Project.ID)
		}
		if got := budgetRecord.ReservedCents; got != shotWorkbenchEstimatedCostCents {
			t.Fatalf("expected stored reserved budget %d, got %d", shotWorkbenchEstimatedCostCents, got)
		}
		if got := budgetRecord.LimitCents - budgetRecord.ReservedCents; got != shotWorkbenchRemainingBudgetCents {
			t.Fatalf("expected stored remaining budget %d, got %d", shotWorkbenchRemainingBudgetCents, got)
		}

		storedBillingEvents := reloadedStore.ListBillingEventsByProject(scenario.Project.ID)
		if len(storedBillingEvents) != 1 {
			t.Fatalf("expected 1 stored billing event after reopen, got %d", len(storedBillingEvents))
		}
		if got := storedBillingEvents[0].EventType; got != "execution_reserved" {
			t.Fatalf("expected stored billing event execution_reserved, got %q", got)
		}
	})
}

func TestShotWorkbenchReviewBudgetReplayAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "shot-workbench-review-budget-replay"
	resetNativeIntegrationRuntimeStore(t)

	var scenario shotWorkbenchPersistenceScenario

	t.Run("create replayable shot workbench events", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedShotWorkbenchPersistenceScenario(t, runtimeStore, server, services, "Shot Workbench Replay Project")
	})

	t.Run("verify replay after reopen", func(t *testing.T) {
		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		replayedStream := readUploadReplayStream(t, reloadedServer, scenario.Project.OrganizationID, scenario.Project.ID, scenario.LastEventID, integrationSSEReplayTimeout,
			"event: budget.updated",
			`"project_id":"`+scenario.Project.ID+`"`,
			"event: shot.execution.updated",
			`"shot_execution_id":"`+scenario.ShotExecutionID+`"`,
			`"status":"submitted_for_review"`,
			"event: shot.review.created",
			`"review_id":"`+scenario.ReviewID+`"`,
			`"conclusion":"approved"`,
		)
		if !strings.Contains(replayedStream, "event: budget.updated") {
			t.Fatalf("expected budget.updated in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, "event: shot.execution.updated") {
			t.Fatalf("expected shot.execution.updated in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, "event: shot.review.created") {
			t.Fatalf("expected shot.review.created in replay stream, got %q", replayedStream)
		}
	})
}

func TestShotExecutionReworkPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "shot-execution-rework"
	resetNativeIntegrationRuntimeStore(t)

	var scenario shotExecutionReworkScenario

	t.Run("create rejected review and mark rework required", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedShotExecutionReworkScenario(t, runtimeStore, server, services, "Shot Execution Rework Project", false)
	})

	t.Run("verify persistence after reopen", func(t *testing.T) {
		if scenario.Project.ID == "" || scenario.Shot.ID == "" || scenario.ShotExecutionID == "" || scenario.Run1ID == "" {
			t.Fatal("expected seeded rework scenario")
		}

		verifyShotExecutionReworkReopenState(t, storeKey, scenario, shotExecutionReworkExpectation{
			ExpectedStatus:          "rework_required",
			ExpectedCurrentRunID:    scenario.Run1ID,
			ExpectedRunIDs:          []string{scenario.Run1ID},
			ExpectedRunTriggerTypes: []string{"manual"},
			ExpectedReservedBudget:  int64(shotWorkbenchEstimatedCostCents),
			ExpectedRemainingBudget: int64(shotWorkbenchRemainingBudgetCents),
		})
	})
}

func TestShotExecutionReworkResumePersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "shot-execution-rework-resume"
	resetNativeIntegrationRuntimeStore(t)

	var scenario shotExecutionReworkScenario

	t.Run("create rework scenario and resume with second run", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedShotExecutionReworkScenario(t, runtimeStore, server, services, "Shot Execution Rework Resume Project", true)
	})

	t.Run("verify persistence after reopen", func(t *testing.T) {
		if scenario.Project.ID == "" || scenario.ShotExecutionID == "" || scenario.Run1ID == "" || scenario.Run2ID == "" {
			t.Fatal("expected seeded rework resume scenario")
		}

		verifyShotExecutionReworkReopenState(t, storeKey, scenario, shotExecutionReworkExpectation{
			ExpectedStatus:          "in_progress",
			ExpectedCurrentRunID:    scenario.Run2ID,
			ExpectedRunIDs:          []string{scenario.Run1ID, scenario.Run2ID},
			ExpectedRunTriggerTypes: []string{"manual", "rework"},
			ExpectedReservedBudget:  int64(shotWorkbenchEstimatedCostCents * 2),
			ExpectedRemainingBudget: int64(shotWorkbenchBudgetLimitCents - shotWorkbenchEstimatedCostCents*2),
		})
	})
}

func TestShotExecutionReworkReplayAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "shot-execution-rework-replay"
	resetNativeIntegrationRuntimeStore(t)

	var scenario shotExecutionReworkScenario

	t.Run("create replayable rework events", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
		defer closeUploadIntegrationResources(server, closeFn)()

		scenario = seedShotExecutionReworkScenario(t, runtimeStore, server, services, "Shot Execution Rework Replay Project", true)
	})

	t.Run("verify replay after reopen", func(t *testing.T) {
		if scenario.Project.ID == "" || scenario.LastEventID == "" || scenario.Run2ID == "" {
			t.Fatal("expected replayable rework scenario")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
		defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

		replayedStream := readUploadReplayStream(t, reloadedServer, scenario.Project.OrganizationID, scenario.Project.ID, scenario.LastEventID, integrationSSEReplayTimeout,
			"event: shot.review.created",
			`"review_id":"`+scenario.ReviewID+`"`,
			`"conclusion":"rejected"`,
			"event: shot.execution.updated",
			`"shot_execution_id":"`+scenario.ShotExecutionID+`"`,
			`"status":"rework_required"`,
			`"current_run_id":"`+scenario.Run1ID+`"`,
			`"reason":"镜头节奏需要调整"`,
			`"status":"in_progress"`,
			`"current_run_id":"`+scenario.Run2ID+`"`,
			`"trigger_type":"rework"`,
		)
		if strings.Count(replayedStream, "event: shot.execution.updated") < 2 {
			t.Fatalf("expected at least 2 shot.execution.updated events in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, `"status":"rework_required"`) {
			t.Fatalf("expected rework_required status in replay stream, got %q", replayedStream)
		}
		if !strings.Contains(replayedStream, `"status":"in_progress"`) {
			t.Fatalf("expected in_progress status in replay stream, got %q", replayedStream)
		}
	})
}

type shotExecutionReworkScenario struct {
	Project         project.Project
	Shot            contentdomain.Shot
	ShotExecutionID string
	Run1ID          string
	Run2ID          string
	ReviewID        string
	LastEventID     string
}

type importWorkbenchExecutionScenario struct {
	Project          project.Project
	Shot             contentdomain.Shot
	ImportBatchID    string
	ShotExecutionID  string
	RunID            string
	CandidateAssetID string
	AssetID          string
	LastEventID      string
}

type importWorkbenchExecutionExpectation struct {
	ExpectedStatus         string
	ExpectedPrimaryAssetID string
}

type shotExecutionReworkExpectation struct {
	ExpectedStatus          string
	ExpectedCurrentRunID    string
	ExpectedRunIDs          []string
	ExpectedRunTriggerTypes []string
	ExpectedReservedBudget  int64
	ExpectedRemainingBudget int64
}

type shotWorkbenchPersistenceScenario struct {
	Project          project.Project
	Shot             contentdomain.Shot
	ShotExecutionID  string
	RunID            string
	CandidateAssetID string
	PrimaryAssetID   string
	EvaluationRunID  string
	ReviewID         string
	LastEventID      string
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

func newUploadIntegrationHTTPServer(t *testing.T, runtimeStore db.RuntimeStore) (*httptest.Server, runtime.ServiceSet) {
	t.Helper()

	services := runtime.NewFactory(runtimeStore).Services()
	mux := http.NewServeMux()
	connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(services))
	return httptest.NewServer(mux), services
}

func verifyShotExecutionReworkReopenState(t *testing.T, storeKey string, scenario shotExecutionReworkScenario, expected shotExecutionReworkExpectation) {
	t.Helper()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
	defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

	executionClient := executionv1connect.NewExecutionServiceClient(reloadedServer.Client(), reloadedServer.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(reloadedServer.Client(), reloadedServer.URL)
	billingClient := billingv1connect.NewBillingServiceClient(reloadedServer.Client(), reloadedServer.URL)

	workbench, err := executionClient.GetShotWorkbench(context.Background(), connectrpc.NewRequest(&executionv1.GetShotWorkbenchRequest{
		ShotId: scenario.Shot.ID,
	}))
	if err != nil {
		t.Fatalf("GetShotWorkbench returned error after reopen: %v", err)
	}
	if got := workbench.Msg.GetWorkbench().GetShotExecution().GetId(); got != scenario.ShotExecutionID {
		t.Fatalf("expected reopened shot_execution_id %q, got %q", scenario.ShotExecutionID, got)
	}
	if got := workbench.Msg.GetWorkbench().GetShotExecution().GetStatus(); got != expected.ExpectedStatus {
		t.Fatalf("expected reopened shot execution status %q, got %q", expected.ExpectedStatus, got)
	}
	if got := workbench.Msg.GetWorkbench().GetShotExecution().GetCurrentRunId(); got != expected.ExpectedCurrentRunID {
		t.Fatalf("expected reopened current_run_id %q, got %q", expected.ExpectedCurrentRunID, got)
	}
	if got := workbench.Msg.GetWorkbench().GetReviewSummary().GetLatestConclusion(); got != "rejected" {
		t.Fatalf("expected reopened latest review conclusion rejected, got %q", got)
	}
	if got := workbench.Msg.GetWorkbench().GetReviewSummary().GetLatestReviewId(); got != scenario.ReviewID {
		t.Fatalf("expected reopened latest review id %q, got %q", scenario.ReviewID, got)
	}

	runs, err := executionClient.ListShotExecutionRuns(context.Background(), connectrpc.NewRequest(&executionv1.ListShotExecutionRunsRequest{
		ShotExecutionId: scenario.ShotExecutionID,
	}))
	if err != nil {
		t.Fatalf("ListShotExecutionRuns returned error after reopen: %v", err)
	}
	if len(runs.Msg.GetRuns()) != len(expected.ExpectedRunIDs) {
		t.Fatalf("expected %d execution runs after reopen, got %d", len(expected.ExpectedRunIDs), len(runs.Msg.GetRuns()))
	}
	for i, run := range runs.Msg.GetRuns() {
		if got := run.GetId(); got != expected.ExpectedRunIDs[i] {
			t.Fatalf("expected reopened run id %q at index %d, got %q", expected.ExpectedRunIDs[i], i, got)
		}
		if got := run.GetRunNumber(); got != uint32(i+1) {
			t.Fatalf("expected reopened run_number %d at index %d, got %d", i+1, i, got)
		}
		if len(expected.ExpectedRunTriggerTypes) > i {
			if got := run.GetTriggerType(); got != expected.ExpectedRunTriggerTypes[i] {
				t.Fatalf("expected reopened trigger_type %q at index %d, got %q", expected.ExpectedRunTriggerTypes[i], i, got)
			}
		}
	}

	reviews, err := reviewClient.ListShotReviews(context.Background(), connectrpc.NewRequest(&reviewv1.ListShotReviewsRequest{
		ShotExecutionId: scenario.ShotExecutionID,
	}))
	if err != nil {
		t.Fatalf("ListShotReviews returned error after reopen: %v", err)
	}
	if len(reviews.Msg.GetShotReviews()) != 1 {
		t.Fatalf("expected 1 shot review after reopen, got %d", len(reviews.Msg.GetShotReviews()))
	}
	if got := reviews.Msg.GetShotReviews()[0].GetConclusion(); got != "rejected" {
		t.Fatalf("expected reopened review conclusion rejected, got %q", got)
	}

	budgetSnapshot, err := billingClient.GetBudgetSnapshot(context.Background(), connectrpc.NewRequest(&billingv1.GetBudgetSnapshotRequest{
		ProjectId: scenario.Project.ID,
	}))
	if err != nil {
		t.Fatalf("GetBudgetSnapshot returned error after reopen: %v", err)
	}
	if got := budgetSnapshot.Msg.GetBudgetSnapshot().GetRemainingBudgetCents(); got != expected.ExpectedRemainingBudget {
		t.Fatalf("expected reopened remaining budget %d, got %d", expected.ExpectedRemainingBudget, got)
	}

	billingEvents, err := billingClient.ListBillingEvents(context.Background(), connectrpc.NewRequest(&billingv1.ListBillingEventsRequest{
		ProjectId: scenario.Project.ID,
	}))
	if err != nil {
		t.Fatalf("ListBillingEvents returned error after reopen: %v", err)
	}
	if len(billingEvents.Msg.GetBillingEvents()) != len(expected.ExpectedRunIDs) {
		t.Fatalf("expected %d billing events after reopen, got %d", len(expected.ExpectedRunIDs), len(billingEvents.Msg.GetBillingEvents()))
	}
	for _, expectedRunID := range expected.ExpectedRunIDs {
		found := false
		for _, event := range billingEvents.Msg.GetBillingEvents() {
			if event.GetEventType() == "execution_reserved" && event.GetShotExecutionRunId() == expectedRunID {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected execution_reserved billing event for run %q, got %+v", expectedRunID, billingEvents.Msg.GetBillingEvents())
		}
	}

	record, ok := reloadedStore.GetShotExecution(scenario.ShotExecutionID)
	if !ok {
		t.Fatalf("expected shot execution %q after reopen", scenario.ShotExecutionID)
	}
	if got := record.Status; got != expected.ExpectedStatus {
		t.Fatalf("expected stored shot execution status %q, got %q", expected.ExpectedStatus, got)
	}
	if got := record.CurrentRunID; got != expected.ExpectedCurrentRunID {
		t.Fatalf("expected stored current_run_id %q, got %q", expected.ExpectedCurrentRunID, got)
	}

	storedRuns := reloadedStore.ListShotExecutionRuns(scenario.ShotExecutionID)
	if len(storedRuns) != len(expected.ExpectedRunIDs) {
		t.Fatalf("expected %d stored execution runs after reopen, got %d", len(expected.ExpectedRunIDs), len(storedRuns))
	}
	for i, run := range storedRuns {
		if got := run.ID; got != expected.ExpectedRunIDs[i] {
			t.Fatalf("expected stored run id %q at index %d, got %q", expected.ExpectedRunIDs[i], i, got)
		}
		if len(expected.ExpectedRunTriggerTypes) > i {
			if got := run.TriggerType; got != expected.ExpectedRunTriggerTypes[i] {
				t.Fatalf("expected stored trigger_type %q at index %d, got %q", expected.ExpectedRunTriggerTypes[i], i, got)
			}
		}
	}

	storedReviews := reloadedStore.ListReviewsByExecution(scenario.ShotExecutionID)
	if len(storedReviews) != 1 {
		t.Fatalf("expected 1 stored review after reopen, got %d", len(storedReviews))
	}
	if got := storedReviews[0].ID; got != scenario.ReviewID {
		t.Fatalf("expected stored review id %q, got %q", scenario.ReviewID, got)
	}
	if got := storedReviews[0].Conclusion; got != "rejected" {
		t.Fatalf("expected stored review conclusion rejected, got %q", got)
	}

	budgetRecord, ok := reloadedStore.GetBudgetByProject(scenario.Project.ID)
	if !ok {
		t.Fatalf("expected budget for project %q after reopen", scenario.Project.ID)
	}
	if got := budgetRecord.ReservedCents; got != expected.ExpectedReservedBudget {
		t.Fatalf("expected stored reserved budget %d, got %d", expected.ExpectedReservedBudget, got)
	}
	if got := budgetRecord.LimitCents - budgetRecord.ReservedCents; got != expected.ExpectedRemainingBudget {
		t.Fatalf("expected stored remaining budget %d, got %d", expected.ExpectedRemainingBudget, got)
	}

	storedBillingEvents := reloadedStore.ListBillingEventsByProject(scenario.Project.ID)
	if len(storedBillingEvents) != len(expected.ExpectedRunIDs) {
		t.Fatalf("expected %d stored billing events after reopen, got %d", len(expected.ExpectedRunIDs), len(storedBillingEvents))
	}
	for _, expectedRunID := range expected.ExpectedRunIDs {
		found := false
		for _, event := range storedBillingEvents {
			if event.EventType == "execution_reserved" && event.ShotExecutionRunID == expectedRunID {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected stored execution_reserved billing event for run %q, got %+v", expectedRunID, storedBillingEvents)
		}
	}
}

func verifyImportWorkbenchExecutionReopenState(t *testing.T, storeKey string, scenario importWorkbenchExecutionScenario, expected importWorkbenchExecutionExpectation) {
	t.Helper()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
	defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

	assetClient := assetv1connect.NewAssetServiceClient(reloadedServer.Client(), reloadedServer.URL)
	executionClient := executionv1connect.NewExecutionServiceClient(reloadedServer.Client(), reloadedServer.URL)

	workbench, err := assetClient.GetImportBatchWorkbench(context.Background(), connectrpc.NewRequest(&assetv1.GetImportBatchWorkbenchRequest{
		ImportBatchId: scenario.ImportBatchID,
	}))
	if err != nil {
		t.Fatalf("GetImportBatchWorkbench returned error after reopen: %v", err)
	}
	if got := workbench.Msg.GetImportBatch().GetId(); got != scenario.ImportBatchID {
		t.Fatalf("expected reopened import_batch_id %q, got %q", scenario.ImportBatchID, got)
	}
	if got := workbench.Msg.GetImportBatch().GetStatus(); got != "matched_pending_confirm" {
		t.Fatalf("expected reopened import batch status matched_pending_confirm, got %q", got)
	}
	if len(workbench.Msg.GetShotExecutions()) != 1 {
		t.Fatalf("expected 1 shot execution after reopen, got %d", len(workbench.Msg.GetShotExecutions()))
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetId(); got != scenario.ShotExecutionID {
		t.Fatalf("expected reopened shot_execution_id %q, got %q", scenario.ShotExecutionID, got)
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetStatus(); got != expected.ExpectedStatus {
		t.Fatalf("expected reopened shot execution status %q, got %q", expected.ExpectedStatus, got)
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetCurrentRunId(); got != scenario.RunID {
		t.Fatalf("expected reopened current_run_id %q, got %q", scenario.RunID, got)
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetPrimaryAssetId(); got != expected.ExpectedPrimaryAssetID {
		t.Fatalf("expected reopened primary_asset_id %q, got %q", expected.ExpectedPrimaryAssetID, got)
	}
	if len(workbench.Msg.GetCandidateAssets()) != 1 {
		t.Fatalf("expected 1 candidate asset after reopen, got %d", len(workbench.Msg.GetCandidateAssets()))
	}
	if got := workbench.Msg.GetCandidateAssets()[0].GetId(); got != scenario.CandidateAssetID {
		t.Fatalf("expected reopened candidate_asset_id %q, got %q", scenario.CandidateAssetID, got)
	}
	if got := workbench.Msg.GetCandidateAssets()[0].GetAssetId(); got != scenario.AssetID {
		t.Fatalf("expected reopened candidate asset asset_id %q, got %q", scenario.AssetID, got)
	}
	if len(workbench.Msg.GetItems()) != 1 {
		t.Fatalf("expected 1 import batch item after reopen, got %d", len(workbench.Msg.GetItems()))
	}
	if got := workbench.Msg.GetItems()[0].GetStatus(); got != "matched_pending_confirm" {
		t.Fatalf("expected reopened import batch item status matched_pending_confirm, got %q", got)
	}

	executionRecord, err := executionClient.GetShotExecution(context.Background(), connectrpc.NewRequest(&executionv1.GetShotExecutionRequest{
		ShotExecutionId: scenario.ShotExecutionID,
	}))
	if err != nil {
		t.Fatalf("GetShotExecution returned error after reopen: %v", err)
	}
	if got := executionRecord.Msg.GetShotExecution().GetStatus(); got != expected.ExpectedStatus {
		t.Fatalf("expected reopened GetShotExecution status %q, got %q", expected.ExpectedStatus, got)
	}
	if got := executionRecord.Msg.GetShotExecution().GetCurrentRunId(); got != scenario.RunID {
		t.Fatalf("expected reopened GetShotExecution current_run_id %q, got %q", scenario.RunID, got)
	}
	if got := executionRecord.Msg.GetShotExecution().GetPrimaryAssetId(); got != expected.ExpectedPrimaryAssetID {
		t.Fatalf("expected reopened GetShotExecution primary_asset_id %q, got %q", expected.ExpectedPrimaryAssetID, got)
	}

	candidates, err := assetClient.ListCandidateAssets(context.Background(), connectrpc.NewRequest(&assetv1.ListCandidateAssetsRequest{
		ShotExecutionId: scenario.ShotExecutionID,
	}))
	if err != nil {
		t.Fatalf("ListCandidateAssets returned error after reopen: %v", err)
	}
	if len(candidates.Msg.GetAssets()) != 1 {
		t.Fatalf("expected 1 candidate asset after reopen via API, got %d", len(candidates.Msg.GetAssets()))
	}
	if got := candidates.Msg.GetAssets()[0].GetId(); got != scenario.CandidateAssetID {
		t.Fatalf("expected API candidate_asset_id %q, got %q", scenario.CandidateAssetID, got)
	}

	record, ok := reloadedStore.GetShotExecution(scenario.ShotExecutionID)
	if !ok {
		t.Fatalf("expected shot execution %q after reopen", scenario.ShotExecutionID)
	}
	if got := record.Status; got != expected.ExpectedStatus {
		t.Fatalf("expected stored shot execution status %q, got %q", expected.ExpectedStatus, got)
	}
	if got := record.CurrentRunID; got != scenario.RunID {
		t.Fatalf("expected stored current_run_id %q, got %q", scenario.RunID, got)
	}
	if got := record.PrimaryAssetID; got != expected.ExpectedPrimaryAssetID {
		t.Fatalf("expected stored primary_asset_id %q, got %q", expected.ExpectedPrimaryAssetID, got)
	}

	storedCandidates := reloadedStore.ListCandidateAssetsByExecution(scenario.ShotExecutionID)
	if len(storedCandidates) != 1 {
		t.Fatalf("expected 1 stored candidate asset after reopen, got %d", len(storedCandidates))
	}
	if got := storedCandidates[0].ID; got != scenario.CandidateAssetID {
		t.Fatalf("expected stored candidate_asset_id %q, got %q", scenario.CandidateAssetID, got)
	}
	if got := storedCandidates[0].AssetID; got != scenario.AssetID {
		t.Fatalf("expected stored candidate asset asset_id %q, got %q", scenario.AssetID, got)
	}

	items := reloadedStore.ListImportBatchItems(scenario.ImportBatchID)
	if len(items) != 1 {
		t.Fatalf("expected 1 stored import batch item after reopen, got %d", len(items))
	}
	if got := items[0].Status; got != "matched_pending_confirm" {
		t.Fatalf("expected stored import batch item status matched_pending_confirm, got %q", got)
	}
	if got := items[0].AssetID; got != scenario.AssetID {
		t.Fatalf("expected stored import batch item asset_id %q, got %q", scenario.AssetID, got)
	}

	batch, ok := reloadedStore.GetImportBatch(scenario.ImportBatchID)
	if !ok {
		t.Fatalf("expected import batch %q after reopen", scenario.ImportBatchID)
	}
	if got := batch.Status; got != "matched_pending_confirm" {
		t.Fatalf("expected stored import batch status matched_pending_confirm, got %q", got)
	}
}

func createUploadIntegrationProject(t *testing.T, services runtime.ServiceSet, title string) project.Project {
	t.Helper()

	projectRecord, err := services.ProjectService.CreateProject(context.Background(), projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   title,
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	return projectRecord
}

func createShotWorkbenchIntegrationProject(t *testing.T, services runtime.ServiceSet, title string) (project.Project, contentdomain.Shot) {
	t.Helper()

	ctx := context.Background()
	projectRecord, err := services.ProjectService.CreateProject(context.Background(), projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   title,
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	episodeRecord, err := services.ProjectService.CreateEpisode(context.Background(), projectapp.CreateEpisodeInput{
		ProjectID: projectRecord.ID,
		EpisodeNo: 1,
		Title:     "Episode 1",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}

	sceneRecord, err := services.ContentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: projectRecord.ID,
		EpisodeID: episodeRecord.ID,
		SceneNo:   1,
		Title:     "Scene 1",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}

	shotRecord, err := services.ContentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: sceneRecord.ID,
		ShotNo:  1,
		Title:   "Shot 1",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	if _, err := services.ContentService.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       shotRecord.ID,
		ContentLocale: "zh-CN",
		Body:          "主角推门进入房间。",
	}); err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}

	return projectRecord, shotRecord
}

func seedImportWorkbenchExecutionScenario(t *testing.T, runtimeStore db.RuntimeStore, server *httptest.Server, services runtime.ServiceSet, title string, selectPrimary bool) importWorkbenchExecutionScenario {
	t.Helper()

	projectRecord, shotRecord := createShotWorkbenchIntegrationProject(t, services, title)

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)

	run, err := executionClient.StartShotExecutionRun(context.Background(), connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:      shotRecord.ID,
		OperatorId:  db.DefaultDevUserID,
		ProjectId:   projectRecord.ID,
		OrgId:       projectRecord.OrganizationID,
		TriggerType: "manual",
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	shotExecutionID := run.Msg.GetRun().GetShotExecutionId()
	runID := run.Msg.GetRun().GetId()

	importBatch, err := assetClient.CreateImportBatch(context.Background(), connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  projectRecord.ID,
		OrgId:      projectRecord.OrganizationID,
		OperatorId: db.DefaultDevUserID,
		SourceType: "manual_upload",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}

	preCandidateEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	lastEventID := ""
	if len(preCandidateEvents) > 0 {
		lastEventID = preCandidateEvents[len(preCandidateEvents)-1].ID
	}

	candidate, err := assetClient.AddCandidateAsset(context.Background(), connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: shotExecutionID,
		ProjectId:       projectRecord.ID,
		OrgId:           projectRecord.OrganizationID,
		ImportBatchId:   importBatch.Msg.GetImportBatch().GetId(),
		SourceRunId:     runID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	assetID := candidate.Msg.GetAsset().GetAssetId()
	if selectPrimary {
		selected, err := executionClient.SelectPrimaryAsset(context.Background(), connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
			ShotExecutionId: shotExecutionID,
			AssetId:         assetID,
		}))
		if err != nil {
			t.Fatalf("SelectPrimaryAsset returned error: %v", err)
		}
		if got := selected.Msg.GetShotExecution().GetStatus(); got != "primary_selected" {
			t.Fatalf("expected primary_selected after select primary, got %q", got)
		}
	}

	return importWorkbenchExecutionScenario{
		Project:          projectRecord,
		Shot:             shotRecord,
		ImportBatchID:    importBatch.Msg.GetImportBatch().GetId(),
		ShotExecutionID:  shotExecutionID,
		RunID:            runID,
		CandidateAssetID: candidate.Msg.GetAsset().GetId(),
		AssetID:          assetID,
		LastEventID:      lastEventID,
	}
}

func seedShotWorkbenchPersistenceScenario(t *testing.T, runtimeStore db.RuntimeStore, server *httptest.Server, services runtime.ServiceSet, title string) shotWorkbenchPersistenceScenario {
	t.Helper()

	projectRecord, shotRecord := createShotWorkbenchIntegrationProject(t, services, title)

	lastEventID := ""
	preBudgetEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	if len(preBudgetEvents) > 0 {
		lastEventID = preBudgetEvents[len(preBudgetEvents)-1].ID
	}

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(server.Client(), server.URL)
	billingClient := billingv1connect.NewBillingServiceClient(server.Client(), server.URL)

	budgetPolicy, err := billingClient.UpdateBudgetPolicy(context.Background(), connectrpc.NewRequest(&billingv1.UpdateBudgetPolicyRequest{
		ProjectId:  projectRecord.ID,
		OrgId:      projectRecord.OrganizationID,
		LimitCents: shotWorkbenchBudgetLimitCents,
	}))
	if err != nil {
		t.Fatalf("UpdateBudgetPolicy returned error: %v", err)
	}
	if got := budgetPolicy.Msg.GetBudgetPolicy().GetLimitCents(); got != shotWorkbenchBudgetLimitCents {
		t.Fatalf("expected budget limit %d, got %d", shotWorkbenchBudgetLimitCents, got)
	}

	run, err := executionClient.StartShotExecutionRun(context.Background(), connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:             shotRecord.ID,
		OperatorId:         db.DefaultDevUserID,
		ProjectId:          projectRecord.ID,
		OrgId:              projectRecord.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: shotWorkbenchEstimatedCostCents,
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	shotExecutionID := run.Msg.GetRun().GetShotExecutionId()
	runID := run.Msg.GetRun().GetId()

	importBatch, err := assetClient.CreateImportBatch(context.Background(), connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  projectRecord.ID,
		OrgId:      projectRecord.OrganizationID,
		OperatorId: db.DefaultDevUserID,
		SourceType: "manual_upload",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}

	candidate, err := assetClient.AddCandidateAsset(context.Background(), connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: shotExecutionID,
		ProjectId:       projectRecord.ID,
		OrgId:           projectRecord.OrganizationID,
		ImportBatchId:   importBatch.Msg.GetImportBatch().GetId(),
		SourceRunId:     runID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}
	candidateAssetID := candidate.Msg.GetAsset().GetId()
	primaryAssetID := candidate.Msg.GetAsset().GetAssetId()

	selected, err := executionClient.SelectPrimaryAsset(context.Background(), connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         primaryAssetID,
	}))
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	if got := selected.Msg.GetShotExecution().GetStatus(); got != "primary_selected" {
		t.Fatalf("expected primary_selected after select primary, got %q", got)
	}

	gate, err := executionClient.RunSubmissionGateChecks(context.Background(), connectrpc.NewRequest(&executionv1.RunSubmissionGateChecksRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}
	if len(gate.Msg.GetFailedChecks()) != 0 {
		t.Fatalf("expected no failed checks, got %v", gate.Msg.GetFailedChecks())
	}

	evaluationRun, err := reviewClient.CreateEvaluationRun(context.Background(), connectrpc.NewRequest(&reviewv1.CreateEvaluationRunRequest{
		ShotExecutionId: shotExecutionID,
		PassedChecks:    gate.Msg.GetPassedChecks(),
		FailedChecks:    gate.Msg.GetFailedChecks(),
	}))
	if err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}

	submitted, err := executionClient.SubmitShotForReview(context.Background(), connectrpc.NewRequest(&executionv1.SubmitShotForReviewRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("SubmitShotForReview returned error: %v", err)
	}
	if got := submitted.Msg.GetShotExecution().GetStatus(); got != "submitted_for_review" {
		t.Fatalf("expected submitted_for_review, got %q", got)
	}

	shotReview, err := reviewClient.CreateShotReview(context.Background(), connectrpc.NewRequest(&reviewv1.CreateShotReviewRequest{
		ShotExecutionId: shotExecutionID,
		Conclusion:      "approved",
		CommentLocale:   "zh-CN",
		Comment:         "可以通过",
	}))
	if err != nil {
		t.Fatalf("CreateShotReview returned error: %v", err)
	}

	allEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	if len(allEvents) == 0 {
		t.Fatal("expected shot workbench flow to publish project events")
	}

	return shotWorkbenchPersistenceScenario{
		Project:          projectRecord,
		Shot:             shotRecord,
		ShotExecutionID:  shotExecutionID,
		RunID:            runID,
		CandidateAssetID: candidateAssetID,
		PrimaryAssetID:   primaryAssetID,
		EvaluationRunID:  evaluationRun.Msg.GetEvaluationRun().GetId(),
		ReviewID:         shotReview.Msg.GetShotReview().GetId(),
		LastEventID:      lastEventID,
	}
}

func seedShotExecutionReworkScenario(t *testing.T, runtimeStore db.RuntimeStore, server *httptest.Server, services runtime.ServiceSet, title string, resumeWithReworkRun bool) shotExecutionReworkScenario {
	t.Helper()

	projectRecord, shotRecord := createShotWorkbenchIntegrationProject(t, services, title)

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(server.Client(), server.URL)
	billingClient := billingv1connect.NewBillingServiceClient(server.Client(), server.URL)

	budgetPolicy, err := billingClient.UpdateBudgetPolicy(context.Background(), connectrpc.NewRequest(&billingv1.UpdateBudgetPolicyRequest{
		ProjectId:  projectRecord.ID,
		OrgId:      projectRecord.OrganizationID,
		LimitCents: shotWorkbenchBudgetLimitCents,
	}))
	if err != nil {
		t.Fatalf("UpdateBudgetPolicy returned error: %v", err)
	}
	if got := budgetPolicy.Msg.GetBudgetPolicy().GetLimitCents(); got != shotWorkbenchBudgetLimitCents {
		t.Fatalf("expected budget limit %d, got %d", shotWorkbenchBudgetLimitCents, got)
	}

	run1, err := executionClient.StartShotExecutionRun(context.Background(), connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:             shotRecord.ID,
		OperatorId:         db.DefaultDevUserID,
		ProjectId:          projectRecord.ID,
		OrgId:              projectRecord.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: shotWorkbenchEstimatedCostCents,
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	if got := run1.Msg.GetRun().GetRunNumber(); got != 1 {
		t.Fatalf("expected first run_number 1, got %d", got)
	}
	shotExecutionID := run1.Msg.GetRun().GetShotExecutionId()
	run1ID := run1.Msg.GetRun().GetId()

	importBatch, err := assetClient.CreateImportBatch(context.Background(), connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  projectRecord.ID,
		OrgId:      projectRecord.OrganizationID,
		OperatorId: db.DefaultDevUserID,
		SourceType: "manual_upload",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}

	candidate, err := assetClient.AddCandidateAsset(context.Background(), connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: shotExecutionID,
		ProjectId:       projectRecord.ID,
		OrgId:           projectRecord.OrganizationID,
		ImportBatchId:   importBatch.Msg.GetImportBatch().GetId(),
		SourceRunId:     run1ID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	selected, err := executionClient.SelectPrimaryAsset(context.Background(), connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         candidate.Msg.GetAsset().GetAssetId(),
	}))
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	if got := selected.Msg.GetShotExecution().GetStatus(); got != "primary_selected" {
		t.Fatalf("expected primary_selected, got %q", got)
	}

	gate, err := executionClient.RunSubmissionGateChecks(context.Background(), connectrpc.NewRequest(&executionv1.RunSubmissionGateChecksRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}
	if len(gate.Msg.GetFailedChecks()) != 0 {
		t.Fatalf("expected no failed checks, got %v", gate.Msg.GetFailedChecks())
	}

	evaluationRun, err := reviewClient.CreateEvaluationRun(context.Background(), connectrpc.NewRequest(&reviewv1.CreateEvaluationRunRequest{
		ShotExecutionId: shotExecutionID,
		PassedChecks:    gate.Msg.GetPassedChecks(),
		FailedChecks:    gate.Msg.GetFailedChecks(),
	}))
	if err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}
	if got := evaluationRun.Msg.GetEvaluationRun().GetStatus(); got != "passed" {
		t.Fatalf("expected evaluation status passed, got %q", got)
	}

	preSubmitEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	if len(preSubmitEvents) == 0 {
		t.Fatal("expected events before submit-for-review stage")
	}
	lastEventID := preSubmitEvents[len(preSubmitEvents)-1].ID

	submitted, err := executionClient.SubmitShotForReview(context.Background(), connectrpc.NewRequest(&executionv1.SubmitShotForReviewRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("SubmitShotForReview returned error: %v", err)
	}
	if got := submitted.Msg.GetShotExecution().GetStatus(); got != "submitted_for_review" {
		t.Fatalf("expected submitted_for_review, got %q", got)
	}

	reviewRejected, err := reviewClient.CreateShotReview(context.Background(), connectrpc.NewRequest(&reviewv1.CreateShotReviewRequest{
		ShotExecutionId: shotExecutionID,
		Conclusion:      "rejected",
		CommentLocale:   "zh-CN",
		Comment:         "镜头节奏需要调整",
	}))
	if err != nil {
		t.Fatalf("CreateShotReview returned error: %v", err)
	}
	if got := reviewRejected.Msg.GetShotReview().GetConclusion(); got != "rejected" {
		t.Fatalf("expected rejected review, got %q", got)
	}

	reworked, err := executionClient.MarkShotReworkRequired(context.Background(), connectrpc.NewRequest(&executionv1.MarkShotReworkRequiredRequest{
		ShotExecutionId: shotExecutionID,
		Reason:          "镜头节奏需要调整",
	}))
	if err != nil {
		t.Fatalf("MarkShotReworkRequired returned error: %v", err)
	}
	if got := reworked.Msg.GetShotExecution().GetStatus(); got != "rework_required" {
		t.Fatalf("expected rework_required, got %q", got)
	}

	run2ID := ""
	if resumeWithReworkRun {
		run2, err := executionClient.StartShotExecutionRun(context.Background(), connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
			ShotId:             shotRecord.ID,
			OperatorId:         db.DefaultDevUserID,
			ProjectId:          projectRecord.ID,
			OrgId:              projectRecord.OrganizationID,
			TriggerType:        "rework",
			EstimatedCostCents: shotWorkbenchEstimatedCostCents,
		}))
		if err != nil {
			t.Fatalf("StartShotExecutionRun rework returned error: %v", err)
		}
		if got := run2.Msg.GetRun().GetRunNumber(); got != 2 {
			t.Fatalf("expected second run_number 2, got %d", got)
		}
		if got := run2.Msg.GetRun().GetShotExecutionId(); got != shotExecutionID {
			t.Fatalf("expected second run shot_execution_id %q, got %q", shotExecutionID, got)
		}
		run2ID = run2.Msg.GetRun().GetId()
	}

	return shotExecutionReworkScenario{
		Project:         projectRecord,
		Shot:            shotRecord,
		ShotExecutionID: shotExecutionID,
		Run1ID:          run1ID,
		Run2ID:          run2ID,
		ReviewID:        reviewRejected.Msg.GetShotReview().GetId(),
		LastEventID:     lastEventID,
	}
}

func seedUploadIntegrationImportBatch(t *testing.T, runtimeStore db.RuntimeStore, projectRecord project.Project) assetdomain.ImportBatch {
	t.Helper()

	now := publishedAt()
	record := assetdomain.ImportBatch{
		ID:         runtimeStore.GenerateImportBatchID(),
		OrgID:      projectRecord.OrganizationID,
		ProjectID:  projectRecord.ID,
		OperatorID: db.DefaultDevUserID,
		SourceType: "upload_session",
		Status:     "pending_review",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := runtimeStore.SaveImportBatch(context.Background(), record); err != nil {
		t.Fatalf("SaveImportBatch returned error: %v", err)
	}
	return record
}

func seedUploadIntegrationShotExecution(t *testing.T, runtimeStore db.RuntimeStore, projectRecord project.Project) executiondomain.ShotExecution {
	t.Helper()

	now := publishedAt()
	episodeRecord := project.Episode{
		ID:        runtimeStore.GenerateEpisodeID(),
		ProjectID: projectRecord.ID,
		EpisodeNo: 1,
		Title:     "Episode 1",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := runtimeStore.SaveEpisode(context.Background(), episodeRecord); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}

	sceneRecord := contentdomain.Scene{
		ID:           runtimeStore.GenerateSceneID(),
		ProjectID:    projectRecord.ID,
		EpisodeID:    episodeRecord.ID,
		SceneNo:      1,
		Title:        "Scene 1",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := runtimeStore.SaveScene(context.Background(), sceneRecord); err != nil {
		t.Fatalf("SaveScene returned error: %v", err)
	}

	shotRecord := contentdomain.Shot{
		ID:           runtimeStore.GenerateShotID(),
		SceneID:      sceneRecord.ID,
		ShotNo:       1,
		Code:         "SHOT-001",
		Title:        "Shot 1",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := runtimeStore.SaveShot(context.Background(), shotRecord); err != nil {
		t.Fatalf("SaveShot returned error: %v", err)
	}

	record := executiondomain.ShotExecution{
		ID:        runtimeStore.GenerateShotExecutionID(),
		OrgID:     projectRecord.OrganizationID,
		ProjectID: projectRecord.ID,
		ShotID:    shotRecord.ID,
		Status:    "in_progress",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := runtimeStore.SaveShotExecution(context.Background(), record); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}
	return record
}

func performUploadSessionRequest(t *testing.T, client *http.Client, method string, url string, body any) map[string]any {
	t.Helper()

	var requestBody io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("json.Marshal %s %s returned error: %v", method, url, err)
		}
		requestBody = bytes.NewReader(payload)
	}

	request, err := http.NewRequest(method, url, requestBody)
	if err != nil {
		t.Fatalf("http.NewRequest %s %s returned error: %v", method, url, err)
	}
	if body != nil {
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

func readUploadReplayStream(t *testing.T, server *httptest.Server, organizationID string, projectID string, lastEventID string, timeout time.Duration, markers ...string) string {
	t.Helper()

	if timeout <= 0 {
		timeout = integrationSSEReplayTimeout
	}
	sseCtx, cancelSSE := context.WithTimeout(context.Background(), timeout)
	defer cancelSSE()

	request, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+organizationID+"&project_id="+projectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	request.Header.Set("Last-Event-ID", lastEventID)
	request.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected SSE status 200, got %d with body %s", response.StatusCode, string(body))
	}

	return readReliabilityEventStreamUntil(t, response.Body, cancelSSE, timeout, markers...)
}

func closeUploadIntegrationResources(server *httptest.Server, closeFn func()) func() {
	var once sync.Once
	return func() {
		once.Do(func() {
			if server != nil {
				server.Close()
			}
			if closeFn != nil {
				closeFn()
			}
		})
	}
}
