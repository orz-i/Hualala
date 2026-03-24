package projectapp

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestPreviewWorkbenchLifecycle(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	initial, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
	})
	if err != nil {
		t.Fatalf("GetPreviewWorkbench returned error: %v", err)
	}
	if got := initial.Assembly.ProjectID; got != fixture.ProjectID {
		t.Fatalf("expected project %q, got %q", fixture.ProjectID, got)
	}
	if got := len(initial.Items); got != 0 {
		t.Fatalf("expected empty workbench, got %d items", got)
	}

	updated, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[2],
				PrimaryAssetID: "missing-asset",
				SourceRunID:    "missing-run",
				Sequence:       3,
			},
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
				Sequence:       1,
			},
			{
				ShotID:         fixture.ShotIDs[1],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[1]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[1]],
				Sequence:       2,
			},
		},
	})
	if err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}
	if got := updated.Assembly.Status; got != "ready" {
		t.Fatalf("expected status %q, got %q", "ready", got)
	}
	if got := len(updated.Items); got != 3 {
		t.Fatalf("expected 3 assembly items, got %d", got)
	}
	if got := updated.Items[0].ShotID; got != fixture.ShotIDs[0] {
		t.Fatalf("expected first shot %q, got %q", fixture.ShotIDs[0], got)
	}
	if got := updated.Items[0].Shot.ShotCode; got != fixture.ShotCodeByID[fixture.ShotIDs[0]] {
		t.Fatalf("expected first shot code %q, got %q", fixture.ShotCodeByID[fixture.ShotIDs[0]], got)
	}
	if got := updated.Items[0].Shot.ProjectTitle; got != "预演项目" {
		t.Fatalf("expected project title %q, got %q", "预演项目", got)
	}
	if updated.Items[0].PrimaryAsset == nil {
		t.Fatalf("expected primary asset summary")
	}
	if got := updated.Items[0].PrimaryAsset.MediaType; got != "image" {
		t.Fatalf("expected media type %q, got %q", "image", got)
	}
	if updated.Items[0].SourceRun == nil {
		t.Fatalf("expected latest run summary")
	}
	if got := updated.Items[0].SourceRun.TriggerType; got != "manual" {
		t.Fatalf("expected trigger type %q, got %q", "manual", got)
	}
	if got := updated.Items[2].ShotID; got != fixture.ShotIDs[2] {
		t.Fatalf("expected third shot %q, got %q", fixture.ShotIDs[2], got)
	}
	if updated.Items[2].PrimaryAsset != nil {
		t.Fatalf("expected missing asset summary to stay nil")
	}
	if updated.Items[2].SourceRun != nil {
		t.Fatalf("expected missing run summary to stay nil")
	}

	reordered, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "completed",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[1],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[1]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[1]],
				Sequence:       1,
			},
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
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
	if got := reordered.Items[0].ShotID; got != fixture.ShotIDs[1] {
		t.Fatalf("expected reordered first shot %q, got %q", fixture.ShotIDs[1], got)
	}
	if got := reordered.Items[0].PrimaryAssetID; got != fixture.AssetIDByShotID[fixture.ShotIDs[1]] {
		t.Fatalf("expected updated asset %q, got %q", fixture.AssetIDByShotID[fixture.ShotIDs[1]], got)
	}

	readback, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID:     fixture.ProjectID,
		EpisodeID:     fixture.EpisodeID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("GetPreviewWorkbench readback returned error: %v", err)
	}
	if got := readback.Items[0].ShotID; got != fixture.ShotIDs[1] {
		t.Fatalf("expected persisted first shot %q, got %q", fixture.ShotIDs[1], got)
	}
	if got := readback.Items[1].ShotID; got != fixture.ShotIDs[0] {
		t.Fatalf("expected persisted second shot %q, got %q", fixture.ShotIDs[0], got)
	}
	if got := readback.Items[0].Shot.ShotTitle; got != fixture.ShotTitleByID[fixture.ShotIDs[1]] {
		t.Fatalf("expected stored shot title %q, got %q", fixture.ShotTitleByID[fixture.ShotIDs[1]], got)
	}
}

func TestListPreviewShotOptionsReturnsScopedMetadata(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	options, err := service.ListPreviewShotOptions(ctx, ListPreviewShotOptionsInput{
		ProjectID:     fixture.ProjectID,
		EpisodeID:     fixture.EpisodeID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("ListPreviewShotOptions returned error: %v", err)
	}
	if got := len(options); got != 3 {
		t.Fatalf("expected 3 shot options, got %d", got)
	}
	if got := options[0].Shot.ShotID; got != fixture.ShotIDs[0] {
		t.Fatalf("expected first option shot %q, got %q", fixture.ShotIDs[0], got)
	}
	if got := options[1].Shot.ShotID; got != fixture.ShotIDs[1] {
		t.Fatalf("expected second option shot %q, got %q", fixture.ShotIDs[1], got)
	}
	if got := options[2].Shot.ShotID; got != fixture.ShotIDs[2] {
		t.Fatalf("expected third option shot %q, got %q", fixture.ShotIDs[2], got)
	}
	if got := options[0].ShotExecutionID; got != fixture.ExecutionIDByShotID[fixture.ShotIDs[0]] {
		t.Fatalf("expected shot execution %q, got %q", fixture.ExecutionIDByShotID[fixture.ShotIDs[0]], got)
	}
	if got := options[0].ShotExecutionStatus; got != "ready" {
		t.Fatalf("expected execution status %q, got %q", "ready", got)
	}
	if options[0].CurrentPrimaryAsset == nil {
		t.Fatalf("expected current primary asset summary")
	}
	if got := options[0].CurrentPrimaryAsset.RightsStatus; got != "cleared" {
		t.Fatalf("expected rights status %q, got %q", "cleared", got)
	}
	if options[0].LatestRun == nil {
		t.Fatalf("expected latest run summary")
	}
	if got := options[0].LatestRun.RunID; got != fixture.LatestRunIDByShotID[fixture.ShotIDs[0]] {
		t.Fatalf("expected latest run id %q, got %q", fixture.LatestRunIDByShotID[fixture.ShotIDs[0]], got)
	}
	if got := options[2].Shot.SceneCode; got != "SCENE-002" {
		t.Fatalf("expected last scene code %q, got %q", "SCENE-002", got)
	}
	if options[2].CurrentPrimaryAsset != nil {
		t.Fatalf("expected missing primary asset summary for shot without execution")
	}
	if options[2].LatestRun != nil {
		t.Fatalf("expected missing latest run summary for shot without execution")
	}
}

func TestListPreviewShotOptionsReturnsEmptyWhenEpisodeHasNoShots(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	emptyEpisodeID := store.GenerateEpisodeID()
	now := time.Now().UTC()
	if err := store.SaveEpisode(ctx, project.Episode{
		ID:        emptyEpisodeID,
		ProjectID: fixture.ProjectID,
		EpisodeNo: 2,
		Title:     "第二集",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}

	options, err := service.ListPreviewShotOptions(ctx, ListPreviewShotOptionsInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: emptyEpisodeID,
	})
	if err != nil {
		t.Fatalf("ListPreviewShotOptions returned error: %v", err)
	}
	if len(options) != 0 {
		t.Fatalf("expected no shot options, got %d", len(options))
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

func TestPreviewWorkbenchRejectsMismatchedEpisodeScope(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	first := seedPreviewProject(t, ctx, store)
	second := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	_, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID: first.ProjectID,
		EpisodeID: second.EpisodeID,
	})
	if err == nil {
		t.Fatalf("expected GetPreviewWorkbench to reject mismatched episode scope")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}

	_, err = service.ListPreviewShotOptions(ctx, ListPreviewShotOptionsInput{
		ProjectID: first.ProjectID,
		EpisodeID: second.EpisodeID,
	})
	if err == nil {
		t.Fatalf("expected ListPreviewShotOptions to reject mismatched episode scope")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

type previewFixture struct {
	ProjectID           string
	EpisodeID           string
	ShotIDs             []string
	ShotCodeByID        map[string]string
	ShotTitleByID       map[string]string
	ExecutionIDByShotID map[string]string
	LatestRunIDByShotID map[string]string
	AssetIDByShotID     map[string]string
}

func seedPreviewProject(t *testing.T, ctx context.Context, store *db.MemoryStore) previewFixture {
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

	secondSceneID := store.GenerateSceneID()
	if err := store.SaveScene(ctx, content.Scene{
		ID:           secondSceneID,
		ProjectID:    projectID,
		EpisodeID:    episodeID,
		SceneNo:      2,
		Code:         "SCENE-002",
		Title:        "转场",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveScene second returned error: %v", err)
	}

	shotIDs := make([]string, 0, 3)
	shotCodeByID := make(map[string]string, 3)
	shotTitleByID := make(map[string]string, 3)
	executionIDByShotID := make(map[string]string, 2)
	latestRunIDByShotID := make(map[string]string, 2)
	assetIDByShotID := make(map[string]string, 2)
	sceneIDs := []string{sceneID, sceneID, secondSceneID}
	sceneCodes := []string{"SCENE-001", "SCENE-001", "SCENE-002"}
	titles := []string{"镜头1", "镜头2", "镜头3"}
	for index := 1; index <= 3; index++ {
		shotID := store.GenerateShotID()
		code := fmt.Sprintf("%s-SHOT-%03d", sceneCodes[index-1], index)
		if err := store.SaveShot(ctx, content.Shot{
			ID:           shotID,
			SceneID:      sceneIDs[index-1],
			ShotNo:       index,
			Code:         code,
			Title:        titles[index-1],
			SourceLocale: "zh-CN",
			CreatedAt:    now,
			UpdatedAt:    now,
		}); err != nil {
			t.Fatalf("SaveShot returned error: %v", err)
		}
		shotIDs = append(shotIDs, shotID)
		shotCodeByID[shotID] = code
		shotTitleByID[shotID] = titles[index-1]
		if index >= 3 {
			continue
		}

		assetID := store.GenerateMediaAssetID()
		if err := store.SaveMediaAsset(ctx, asset.MediaAsset{
			ID:            assetID,
			OrgID:         "org-1",
			ProjectID:     projectID,
			ImportBatchID: fmt.Sprintf("batch-%d", index),
			MediaType:     "image",
			SourceType:    "upload",
			Locale:        "zh-CN",
			RightsStatus:  "cleared",
			AIAnnotated:   index == 1,
			CreatedAt:     now,
			UpdatedAt:     now,
		}); err != nil {
			t.Fatalf("SaveMediaAsset returned error: %v", err)
		}
		assetIDByShotID[shotID] = assetID

		executionID := store.GenerateShotExecutionID()
		if err := store.SaveShotExecution(ctx, execution.ShotExecution{
			ID:             executionID,
			OrgID:          "org-1",
			ProjectID:      projectID,
			ShotID:         shotID,
			Status:         "ready",
			PrimaryAssetID: assetID,
			CurrentRunID:   "",
			CreatedAt:      now,
			UpdatedAt:      now,
		}); err != nil {
			t.Fatalf("SaveShotExecution returned error: %v", err)
		}
		executionIDByShotID[shotID] = executionID

		firstRunID := store.GenerateShotExecutionRunID()
		if err := store.SaveShotExecutionRun(ctx, execution.ShotExecutionRun{
			ID:              firstRunID,
			ShotExecutionID: executionID,
			RunNumber:       1,
			Status:          "completed",
			TriggerType:     "retry",
			OperatorID:      "user-1",
			CreatedAt:       now,
			UpdatedAt:       now,
		}); err != nil {
			t.Fatalf("SaveShotExecutionRun #1 returned error: %v", err)
		}
		secondRunID := store.GenerateShotExecutionRunID()
		if err := store.SaveShotExecutionRun(ctx, execution.ShotExecutionRun{
			ID:              secondRunID,
			ShotExecutionID: executionID,
			RunNumber:       2,
			Status:          "completed",
			TriggerType:     "manual",
			OperatorID:      "user-1",
			CreatedAt:       now,
			UpdatedAt:       now,
		}); err != nil {
			t.Fatalf("SaveShotExecutionRun #2 returned error: %v", err)
		}
		latestRunIDByShotID[shotID] = secondRunID
	}
	return previewFixture{
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		ShotIDs:             shotIDs,
		ShotCodeByID:        shotCodeByID,
		ShotTitleByID:       shotTitleByID,
		ExecutionIDByShotID: executionIDByShotID,
		LatestRunIDByShotID: latestRunIDByShotID,
		AssetIDByShotID:     assetIDByShotID,
	}
}
