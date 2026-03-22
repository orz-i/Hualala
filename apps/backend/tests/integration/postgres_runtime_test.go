package integration

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
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
