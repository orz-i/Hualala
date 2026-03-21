package integration

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

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

	replayed := reloadedStore.Publisher().List(db.DefaultDevOrganizationID, projectID, "")
	if len(replayed) != 1 {
		t.Fatalf("expected 1 durable event after reopen, got %d", len(replayed))
	}
	if got := replayed[0].ID; got != published.ID {
		t.Fatalf("expected replayed event id %q, got %q", published.ID, got)
	}
	if got := replayed[0].EventType; got != "workflow.updated" {
		t.Fatalf("expected workflow.updated replay, got %q", got)
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
