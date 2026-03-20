package integration

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestProjectContentFlow(t *testing.T) {
	ctx := context.Background()
	fixture := openIntegrationFixture(t)

	projectService := fixture.Services.ProjectService
	contentService := fixture.Services.ContentService

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   "AI 剧集平台",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN", "en-US"},
		CurrentStage:            "storyboarding",
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	episode, err := projectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}

	scene, err := contentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "开场",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}

	shot, err := contentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "主角入场",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	sourceSnapshot, err := contentService.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       shot.ID,
		ContentLocale: "zh-CN",
		Body:          "主角走入画面，镜头缓慢推进。",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}

	localizedSnapshot, err := contentService.CreateLocalizedSnapshot(ctx, contentapp.CreateLocalizedSnapshotInput{
		SourceSnapshotID: sourceSnapshot.ID,
		ContentLocale:    "en-US",
		Body:             "The lead enters frame while the camera slowly pushes in.",
	})
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot returned error: %v", err)
	}

	scenes, err := contentService.ListScenes(ctx, contentapp.ListScenesInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
	})
	if err != nil {
		t.Fatalf("ListScenes returned error: %v", err)
	}
	if len(scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(scenes))
	}

	shots, err := contentService.ListSceneShots(ctx, contentapp.ListSceneShotsInput{
		SceneID: scene.ID,
	})
	if err != nil {
		t.Fatalf("ListSceneShots returned error: %v", err)
	}
	if len(shots) != 1 {
		t.Fatalf("expected 1 shot, got %d", len(shots))
	}

	gotShot, err := contentService.GetShot(ctx, contentapp.GetShotInput{
		ShotID: shot.ID,
	})
	if err != nil {
		t.Fatalf("GetShot returned error: %v", err)
	}
	if gotShot.Title != "主角入场" {
		t.Fatalf("expected shot title %q, got %q", "主角入场", gotShot.Title)
	}

	if sourceSnapshot.TranslationStatus != "source" {
		t.Fatalf("expected source snapshot translation status %q, got %q", "source", sourceSnapshot.TranslationStatus)
	}
	if localizedSnapshot.SourceSnapshotID != sourceSnapshot.ID {
		t.Fatalf("expected localized snapshot source id %q, got %q", sourceSnapshot.ID, localizedSnapshot.SourceSnapshotID)
	}
	if localizedSnapshot.TranslationStatus != "draft_translation" {
		t.Fatalf("expected localized snapshot translation status %q, got %q", "draft_translation", localizedSnapshot.TranslationStatus)
	}
	if localizedSnapshot.TranslationGroupID != sourceSnapshot.TranslationGroupID {
		t.Fatalf("expected localized snapshot group id %q, got %q", sourceSnapshot.TranslationGroupID, localizedSnapshot.TranslationGroupID)
	}
}
