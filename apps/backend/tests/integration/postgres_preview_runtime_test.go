package integration

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestPostgresStorePersistsPreviewRuntimeSharedTruth(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "preview-runtime"
	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)

	now := publishedAt()
	projectID := runtimeStore.GenerateProjectID()
	if err := runtimeStore.SaveProject(context.Background(), project.Project{
		ID:                   projectID,
		OrganizationID:       db.DefaultDevOrganizationID,
		OwnerUserID:          db.DefaultDevUserID,
		Title:                "Preview Runtime",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}

	episodeID := runtimeStore.GenerateEpisodeID()
	if err := runtimeStore.SaveEpisode(context.Background(), project.Episode{
		ID:        episodeID,
		ProjectID: projectID,
		EpisodeNo: 1,
		Title:     "第一集",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}

	assemblyID := runtimeStore.GeneratePreviewAssemblyID()
	if err := runtimeStore.SavePreviewAssembly(context.Background(), project.PreviewAssembly{
		ID:        assemblyID,
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("SavePreviewAssembly returned error: %v", err)
	}

	runtimeID := runtimeStore.GeneratePreviewRuntimeID()
	if err := runtimeStore.SavePreviewRuntime(context.Background(), project.PreviewRuntime{
		ID:                  runtimeID,
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		AssemblyID:          assemblyID,
		Status:              "queued",
		RenderWorkflowRunID: "workflow-run-preview-1",
		RenderStatus:        "queued",
		ResolvedLocale:      "en-US",
		CreatedAt:           now,
		UpdatedAt:           now,
	}); err != nil {
		t.Fatalf("SavePreviewRuntime returned error: %v", err)
	}

	closeFn()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	defer reloadCloseFn()

	record, ok := reloadedStore.GetPreviewRuntime(projectID, episodeID)
	if !ok {
		t.Fatalf("expected preview runtime for %s/%s", projectID, episodeID)
	}
	if got := record.AssemblyID; got != assemblyID {
		t.Fatalf("expected assembly id %q, got %q", assemblyID, got)
	}
	if got := record.RenderStatus; got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := record.ResolvedLocale; got != "en-US" {
		t.Fatalf("expected resolved locale %q, got %q", "en-US", got)
	}
}
