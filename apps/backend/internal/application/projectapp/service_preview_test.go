package projectapp

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestPreviewWorkbenchLifecycle(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, shotIDs := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	initial, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("GetPreviewWorkbench returned error: %v", err)
	}
	if got := initial.Assembly.ProjectID; got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}
	if got := len(initial.Items); got != 0 {
		t.Fatalf("expected empty workbench, got %d items", got)
	}

	updated, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         shotIDs[1],
				PrimaryAssetID: "asset-2",
				SourceRunID:    "run-2",
				Sequence:       2,
			},
			{
				ShotID:         shotIDs[0],
				PrimaryAssetID: "asset-1",
				SourceRunID:    "run-1",
				Sequence:       1,
			},
		},
	})
	if err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}
	if got := updated.Assembly.Status; got != "ready" {
		t.Fatalf("expected status %q, got %q", "ready", got)
	}
	if got := len(updated.Items); got != 2 {
		t.Fatalf("expected 2 assembly items, got %d", got)
	}
	if got := updated.Items[0].ShotID; got != shotIDs[0] {
		t.Fatalf("expected first shot %q, got %q", shotIDs[0], got)
	}
	if got := updated.Items[1].ShotID; got != shotIDs[1] {
		t.Fatalf("expected second shot %q, got %q", shotIDs[1], got)
	}

	reordered, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "completed",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         shotIDs[1],
				PrimaryAssetID: "asset-9",
				SourceRunID:    "run-9",
				Sequence:       1,
			},
			{
				ShotID:         shotIDs[0],
				PrimaryAssetID: "asset-3",
				SourceRunID:    "run-3",
				Sequence:       2,
			},
		},
	})
	if err != nil {
		t.Fatalf("reorder UpsertPreviewAssembly returned error: %v", err)
	}
	if got := reordered.Assembly.Status; got != "completed" {
		t.Fatalf("expected status %q, got %q", "completed", got)
	}
	if got := reordered.Items[0].ShotID; got != shotIDs[1] {
		t.Fatalf("expected reordered first shot %q, got %q", shotIDs[1], got)
	}
	if got := reordered.Items[0].PrimaryAssetID; got != "asset-9" {
		t.Fatalf("expected updated asset %q, got %q", "asset-9", got)
	}

	readback, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("GetPreviewWorkbench readback returned error: %v", err)
	}
	if got := readback.Items[0].ShotID; got != shotIDs[1] {
		t.Fatalf("expected persisted first shot %q, got %q", shotIDs[1], got)
	}
	if got := readback.Items[1].ShotID; got != shotIDs[0] {
		t.Fatalf("expected persisted second shot %q, got %q", shotIDs[0], got)
	}
}

func TestPreviewWorkbenchRejectsUnknownProject(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	_, err := service.GetPreviewWorkbench(context.Background(), GetPreviewWorkbenchInput{
		ProjectID: "missing-project",
	})
	if err == nil {
		t.Fatalf("expected GetPreviewWorkbench to reject missing project")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func seedPreviewProject(t *testing.T, ctx context.Context, store *db.MemoryStore) (string, string, []string) {
	t.Helper()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "预演项目",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	episodeID := store.GenerateEpisodeID()
	if err := store.SaveEpisode(ctx, project.Episode{
		ID:        episodeID,
		ProjectID: projectID,
		EpisodeNo: 1,
		Title:     "第一集",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}
	sceneID := store.GenerateSceneID()
	if err := store.SaveScene(ctx, content.Scene{
		ID:           sceneID,
		ProjectID:    projectID,
		EpisodeID:    episodeID,
		SceneNo:      1,
		Code:         "SCENE-001",
		Title:        "开场",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveScene returned error: %v", err)
	}

	shotIDs := make([]string, 0, 2)
	for index := 1; index <= 2; index++ {
		shotID := store.GenerateShotID()
		if err := store.SaveShot(ctx, content.Shot{
			ID:           shotID,
			SceneID:      sceneID,
			ShotNo:       index,
			Code:         fmt.Sprintf("SCENE-001-SHOT-%03d", index),
			Title:        fmt.Sprintf("镜头%d", index),
			SourceLocale: "zh-CN",
			CreatedAt:    now,
			UpdatedAt:    now,
		}); err != nil {
			t.Fatalf("SaveShot returned error: %v", err)
		}
		shotIDs = append(shotIDs, shotID)
	}
	return projectID, episodeID, shotIDs
}
