package contentapp

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestCollaborationLeaseLifecycle(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	shotID := seedCollaborationShot(t, ctx, store)
	service := NewService(store)

	claimed, err := service.UpsertCollaborationLease(ctx, UpsertCollaborationLeaseInput{
		OwnerType:       "shot",
		OwnerID:         shotID,
		ActorUserID:     "user-1",
		PresenceStatus:  "editing",
		DraftVersion:    3,
		LeaseTTLSeconds: 120,
	})
	if err != nil {
		t.Fatalf("UpsertCollaborationLease returned error: %v", err)
	}
	if got := claimed.Session.OwnerID; got != shotID {
		t.Fatalf("expected owner %q, got %q", shotID, got)
	}
	if got := claimed.Session.LockHolderUserID; got != "user-1" {
		t.Fatalf("expected lock holder %q, got %q", "user-1", got)
	}
	if got := claimed.Session.DraftVersion; got != 3 {
		t.Fatalf("expected draft version %d, got %d", 3, got)
	}
	if len(claimed.Presences) != 1 {
		t.Fatalf("expected 1 presence, got %d", len(claimed.Presences))
	}

	renewed, err := service.UpsertCollaborationLease(ctx, UpsertCollaborationLeaseInput{
		OwnerType:       "shot",
		OwnerID:         shotID,
		ActorUserID:     "user-1",
		PresenceStatus:  "editing",
		DraftVersion:    4,
		LeaseTTLSeconds: 180,
	})
	if err != nil {
		t.Fatalf("renew UpsertCollaborationLease returned error: %v", err)
	}
	if got := renewed.Session.DraftVersion; got != 4 {
		t.Fatalf("expected renewed draft version %d, got %d", 4, got)
	}

	_, err = service.ReleaseCollaborationLease(ctx, ReleaseCollaborationLeaseInput{
		OwnerType:   "shot",
		OwnerID:     shotID,
		ActorUserID: "user-2",
	})
	if err == nil {
		t.Fatalf("expected ReleaseCollaborationLease to reject non-holder release")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}

	expired := store.CollaborationSessions[renewed.Session.ID]
	expired.LeaseExpiresAt = time.Now().UTC().Add(-time.Minute)
	expired.UpdatedAt = expired.LeaseExpiresAt
	store.CollaborationSessions[expired.ID] = expired

	reclaimed, err := service.UpsertCollaborationLease(ctx, UpsertCollaborationLeaseInput{
		OwnerType:       "shot",
		OwnerID:         shotID,
		ActorUserID:     "user-2",
		PresenceStatus:  "reviewing",
		DraftVersion:    5,
		LeaseTTLSeconds: 60,
	})
	if err != nil {
		t.Fatalf("expired UpsertCollaborationLease returned error: %v", err)
	}
	if got := reclaimed.Session.LockHolderUserID; got != "user-2" {
		t.Fatalf("expected reclaimed lock holder %q, got %q", "user-2", got)
	}
	if len(reclaimed.Presences) != 2 {
		t.Fatalf("expected 2 presences after reclaim, got %d", len(reclaimed.Presences))
	}

	released, err := service.ReleaseCollaborationLease(ctx, ReleaseCollaborationLeaseInput{
		OwnerType:       "shot",
		OwnerID:         shotID,
		ActorUserID:     "user-2",
		ConflictSummary: "",
	})
	if err != nil {
		t.Fatalf("ReleaseCollaborationLease returned error: %v", err)
	}
	if got := released.Session.LockHolderUserID; got != "" {
		t.Fatalf("expected released session to clear lock holder, got %q", got)
	}
}

func TestGetCollaborationSessionRejectsUnknownOwner(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	_, err := service.GetCollaborationSession(context.Background(), GetCollaborationSessionInput{
		OwnerType: "shot",
		OwnerID:   "missing-shot",
	})
	if err == nil {
		t.Fatalf("expected GetCollaborationSession to reject missing owner")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func seedCollaborationShot(t *testing.T, ctx context.Context, store *db.MemoryStore) string {
	t.Helper()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "协同项目",
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
	return shotID
}
