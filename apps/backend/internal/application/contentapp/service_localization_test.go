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

func TestTitleLocalizationSnapshotsResolveDisplayLocale(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedLocalizationFixture(t, ctx, store)
	service := NewService(store, nil)

	sceneSource, err := service.CreateContentSnapshot(ctx, CreateContentSnapshotInput{
		OwnerType:     "scene",
		OwnerID:       fixture.SceneID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "开场",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot(scene title) returned error: %v", err)
	}
	if got := sceneSource.SnapshotKind; got != "title" {
		t.Fatalf("expected scene snapshot kind %q, got %q", "title", got)
	}

	shotSource, err := service.CreateContentSnapshot(ctx, CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       fixture.ShotID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "主角入场",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot(shot title) returned error: %v", err)
	}

	sceneLocalized, err := service.CreateLocalizedSnapshot(ctx, CreateLocalizedSnapshotInput{
		SourceSnapshotID: sceneSource.ID,
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Opening",
	})
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot(scene title) returned error: %v", err)
	}
	if got := sceneLocalized.SnapshotKind; got != "title" {
		t.Fatalf("expected localized scene snapshot kind %q, got %q", "title", got)
	}

	_, err = service.CreateLocalizedSnapshot(ctx, CreateLocalizedSnapshotInput{
		SourceSnapshotID: shotSource.ID,
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Hero enters",
	})
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot(shot title) returned error: %v", err)
	}

	scenes, err := service.ListScenes(ctx, ListScenesInput{
		ProjectID:     fixture.ProjectID,
		EpisodeID:     fixture.EpisodeID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("ListScenes returned error: %v", err)
	}
	if got := scenes[0].Title; got != "Opening" {
		t.Fatalf("expected localized scene title %q, got %q", "Opening", got)
	}
	if got := scenes[0].SourceLocale; got != "zh-CN" {
		t.Fatalf("expected scene source locale %q, got %q", "zh-CN", got)
	}

	sceneRecord, err := service.GetScene(ctx, GetSceneInput{
		SceneID:       fixture.SceneID,
		DisplayLocale: "fr-FR",
	})
	if err != nil {
		t.Fatalf("GetScene returned error: %v", err)
	}
	if got := sceneRecord.Title; got != "开场" {
		t.Fatalf("expected scene fallback title %q, got %q", "开场", got)
	}

	shots, err := service.ListSceneShots(ctx, ListSceneShotsInput{
		SceneID:       fixture.SceneID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("ListSceneShots returned error: %v", err)
	}
	if got := shots[0].Title; got != "Hero enters" {
		t.Fatalf("expected localized shot title %q, got %q", "Hero enters", got)
	}

	shotRecord, err := service.GetShot(ctx, GetShotInput{
		ShotID:        fixture.ShotID,
		DisplayLocale: "ja-JP",
	})
	if err != nil {
		t.Fatalf("GetShot returned error: %v", err)
	}
	if got := shotRecord.Title; got != "主角入场" {
		t.Fatalf("expected shot fallback title %q, got %q", "主角入场", got)
	}
}

func TestTitleLocalizationRejectsInvalidOwnersAndSourceKinds(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedLocalizationFixture(t, ctx, store)
	service := NewService(store, nil)

	_, err := service.CreateContentSnapshot(ctx, CreateContentSnapshotInput{
		OwnerType:     "project",
		OwnerID:       fixture.ProjectID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "项目标题",
	})
	if err == nil {
		t.Fatalf("expected CreateContentSnapshot to reject project title snapshot")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "invalid argument") {
		t.Fatalf("expected invalid argument error, got %v", err)
	}

	sourceSnapshot, err := service.CreateContentSnapshot(ctx, CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       fixture.ShotID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "content",
		Body:          "主角走入画面。",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot(content) returned error: %v", err)
	}

	_, err = service.CreateLocalizedSnapshot(ctx, CreateLocalizedSnapshotInput{
		SourceSnapshotID: sourceSnapshot.ID,
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Hero enters frame.",
	})
	if err == nil {
		t.Fatalf("expected CreateLocalizedSnapshot to reject mismatched snapshot kind")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

type localizationFixture struct {
	ProjectID string
	EpisodeID string
	SceneID   string
	ShotID    string
}

func seedLocalizationFixture(t *testing.T, ctx context.Context, store *db.MemoryStore) localizationFixture {
	t.Helper()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "本地化项目",
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
	return localizationFixture{
		ProjectID: projectID,
		EpisodeID: episodeID,
		SceneID:   sceneID,
		ShotID:    shotID,
	}
}
