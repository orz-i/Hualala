package db

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
)

func TestMemoryStoreImplementsPhase2Repositories(t *testing.T) {
	var _ AuthOrgRepository = (*MemoryStore)(nil)
	var _ ProjectContentRepository = (*MemoryStore)(nil)
	var _ ExecutionRepository = (*MemoryStore)(nil)
	var _ AssetRepository = (*MemoryStore)(nil)
	var _ ReviewBillingRepository = (*MemoryStore)(nil)
	var _ PolicyReader = (*MemoryStore)(nil)
	var _ GatewayResultStore = (*MemoryStore)(nil)
	var _ WorkflowRepository = (*MemoryStore)(nil)
	var _ RuntimeStore = (*MemoryStore)(nil)
}

func TestMemoryStoreGetCollaborationScope(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	now := time.Now().UTC()

	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "Scope Project",
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

	shotID := store.GenerateShotID()
	if err := store.SaveShot(ctx, content.Shot{
		ID:           shotID,
		SceneID:      sceneID,
		ShotNo:       1,
		Code:         "SCENE-001-SHOT-001",
		Title:        "主角入场",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveShot returned error: %v", err)
	}

	for _, tc := range []struct {
		name      string
		ownerType string
		ownerID   string
	}{
		{name: "project", ownerType: "project", ownerID: projectID},
		{name: "episode", ownerType: "episode", ownerID: episodeID},
		{name: "scene", ownerType: "scene", ownerID: sceneID},
		{name: "shot", ownerType: "shot", ownerID: shotID},
	} {
		t.Run(tc.name, func(t *testing.T) {
			orgID, gotProjectID, err := store.GetCollaborationScope(tc.ownerType, tc.ownerID)
			if err != nil {
				t.Fatalf("GetCollaborationScope returned error: %v", err)
			}
			if orgID != "org-1" {
				t.Fatalf("expected org-1, got %q", orgID)
			}
			if gotProjectID != projectID {
				t.Fatalf("expected project %q, got %q", projectID, gotProjectID)
			}
		})
	}

	if _, _, err := store.GetCollaborationScope("shot", "missing-shot"); err == nil {
		t.Fatal("expected missing shot to fail")
	}
	if _, _, err := store.GetCollaborationScope("invalid", "owner-1"); err == nil {
		t.Fatal("expected invalid owner type to fail")
	} else if !strings.Contains(err.Error(), "owner_type") {
		t.Fatalf("expected owner_type validation error, got %v", err)
	}
}
