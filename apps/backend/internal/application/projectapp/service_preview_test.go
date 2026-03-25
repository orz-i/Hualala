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
	"github.com/hualala/apps/backend/internal/domain/workflow"
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
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
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
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
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

func TestListPreviewShotOptionsReturnsProjectScopedShotsWhenEpisodeIsEmpty(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	options, err := service.ListPreviewShotOptions(ctx, ListPreviewShotOptionsInput{
		ProjectID: fixture.ProjectID,
	})
	if err != nil {
		t.Fatalf("ListPreviewShotOptions returned error: %v", err)
	}
	if got := len(options); got != 3 {
		t.Fatalf("expected 3 project-scoped shot options, got %d", got)
	}
	if got := options[0].Shot.EpisodeID; got != fixture.EpisodeID {
		t.Fatalf("expected project-scoped first option episode %q, got %q", fixture.EpisodeID, got)
	}
}

func TestPreviewMetadataResolvesLocalizedSceneAndShotTitles(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	now := time.Now().UTC()
	sceneID := fixture.SceneIDByShotID[fixture.ShotIDs[0]]

	sceneSourceID := store.GenerateSnapshotID()
	sceneGroupID := store.GenerateTranslationGroupID()
	if err := store.SaveSnapshot(ctx, content.Snapshot{
		ID:                 sceneSourceID,
		OwnerType:          "scene",
		OwnerID:            sceneID,
		SnapshotKind:       "title",
		Locale:             "zh-CN",
		TranslationGroupID: sceneGroupID,
		TranslationStatus:  "source",
		Body:               "开场",
		CreatedAt:          now,
		UpdatedAt:          now,
	}); err != nil {
		t.Fatalf("SaveSnapshot(scene source) returned error: %v", err)
	}
	if err := store.SaveSnapshot(ctx, content.Snapshot{
		ID:                 store.GenerateSnapshotID(),
		OwnerType:          "scene",
		OwnerID:            sceneID,
		SnapshotKind:       "title",
		Locale:             "en-US",
		SourceSnapshotID:   sceneSourceID,
		TranslationGroupID: sceneGroupID,
		TranslationStatus:  "draft_translation",
		Body:               "Opening",
		CreatedAt:          now,
		UpdatedAt:          now,
	}); err != nil {
		t.Fatalf("SaveSnapshot(scene localized) returned error: %v", err)
	}

	shotSourceID := store.GenerateSnapshotID()
	shotGroupID := store.GenerateTranslationGroupID()
	if err := store.SaveSnapshot(ctx, content.Snapshot{
		ID:                 shotSourceID,
		OwnerType:          "shot",
		OwnerID:            fixture.ShotIDs[0],
		SnapshotKind:       "title",
		Locale:             "zh-CN",
		TranslationGroupID: shotGroupID,
		TranslationStatus:  "source",
		Body:               fixture.ShotTitleByID[fixture.ShotIDs[0]],
		CreatedAt:          now,
		UpdatedAt:          now,
	}); err != nil {
		t.Fatalf("SaveSnapshot(shot source) returned error: %v", err)
	}
	if err := store.SaveSnapshot(ctx, content.Snapshot{
		ID:                 store.GenerateSnapshotID(),
		OwnerType:          "shot",
		OwnerID:            fixture.ShotIDs[0],
		SnapshotKind:       "title",
		Locale:             "en-US",
		SourceSnapshotID:   shotSourceID,
		TranslationGroupID: shotGroupID,
		TranslationStatus:  "draft_translation",
		Body:               "First shot localized",
		CreatedAt:          now,
		UpdatedAt:          now,
	}); err != nil {
		t.Fatalf("SaveSnapshot(shot localized) returned error: %v", err)
	}

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
				Sequence:       1,
			},
			{
				ShotID:   fixture.ShotIDs[1],
				Sequence: 2,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	updated, err := service.GetPreviewWorkbench(ctx, GetPreviewWorkbenchInput{
		ProjectID:     fixture.ProjectID,
		EpisodeID:     fixture.EpisodeID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("GetPreviewWorkbench returned error: %v", err)
	}
	if got := updated.Items[0].Shot.SceneTitle; got != "Opening" {
		t.Fatalf("expected localized scene title %q, got %q", "Opening", got)
	}
	if got := updated.Items[0].Shot.ShotTitle; got != "First shot localized" {
		t.Fatalf("expected localized shot title %q, got %q", "First shot localized", got)
	}
	if got := updated.Items[0].Shot.ProjectTitle; got != "预演项目" {
		t.Fatalf("expected project title to stay stored value %q, got %q", "预演项目", got)
	}
	if got := updated.Items[0].Shot.EpisodeTitle; got != "第一集" {
		t.Fatalf("expected episode title to stay stored value %q, got %q", "第一集", got)
	}
	if got := updated.Items[1].Shot.ShotTitle; got != fixture.ShotTitleByID[fixture.ShotIDs[1]] {
		t.Fatalf("expected missing localization to fall back to %q, got %q", fixture.ShotTitleByID[fixture.ShotIDs[1]], got)
	}

	options, err := service.ListPreviewShotOptions(ctx, ListPreviewShotOptionsInput{
		ProjectID:     fixture.ProjectID,
		DisplayLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("ListPreviewShotOptions returned error: %v", err)
	}
	if got := options[0].Shot.SceneTitle; got != "Opening" {
		t.Fatalf("expected localized option scene title %q, got %q", "Opening", got)
	}
	if got := options[0].Shot.ShotTitle; got != "First shot localized" {
		t.Fatalf("expected localized option shot title %q, got %q", "First shot localized", got)
	}
	if got := options[1].Shot.ShotTitle; got != fixture.ShotTitleByID[fixture.ShotIDs[1]] {
		t.Fatalf("expected option fallback title %q, got %q", fixture.ShotTitleByID[fixture.ShotIDs[1]], got)
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

func TestGetPreviewRuntimeAutoCreatesProjectScopedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	runtimeState, err := service.GetPreviewRuntime(ctx, GetPreviewRuntimeInput{
		ProjectID: fixture.ProjectID,
	})
	if err != nil {
		t.Fatalf("GetPreviewRuntime returned error: %v", err)
	}
	if got := runtimeState.Runtime.ProjectID; got != fixture.ProjectID {
		t.Fatalf("expected project %q, got %q", fixture.ProjectID, got)
	}
	if got := runtimeState.Runtime.EpisodeID; got != "" {
		t.Fatalf("expected empty episode_id for project-only scope, got %q", got)
	}
	if got := runtimeState.Runtime.Status; got != "draft" {
		t.Fatalf("expected initial status %q, got %q", "draft", got)
	}
	if got := runtimeState.Runtime.RenderStatus; got != "idle" {
		t.Fatalf("expected initial render_status %q, got %q", "idle", got)
	}
	if got := runtimeState.Runtime.RenderWorkflowRunID; got != "" {
		t.Fatalf("expected empty render workflow run id, got %q", got)
	}
}

func TestGetPreviewRuntimeAutoCreatesEpisodeScopedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	runtimeState, err := service.GetPreviewRuntime(ctx, GetPreviewRuntimeInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
	})
	if err != nil {
		t.Fatalf("GetPreviewRuntime returned error: %v", err)
	}
	if got := runtimeState.Runtime.ProjectID; got != fixture.ProjectID {
		t.Fatalf("expected project %q, got %q", fixture.ProjectID, got)
	}
	if got := runtimeState.Runtime.EpisodeID; got != fixture.EpisodeID {
		t.Fatalf("expected episode %q, got %q", fixture.EpisodeID, got)
	}
}

func TestRequestPreviewRenderQueuesWorkflowRunForNonEmptyAssembly(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
				Sequence:       1,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	runtimeState, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}
	if got := runtimeState.Runtime.Status; got != "queued" {
		t.Fatalf("expected runtime status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.RenderStatus; got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.ResolvedLocale; got != "en-US" {
		t.Fatalf("expected resolved locale %q, got %q", "en-US", got)
	}
	if got := runtimeState.Runtime.AssemblyID; got == "" {
		t.Fatalf("expected assembly_id to be populated")
	}
	if got := runtimeState.Runtime.RenderWorkflowRunID; got == "" {
		t.Fatalf("expected render_workflow_run_id to be populated")
	}

	run, ok := store.GetWorkflowRun(runtimeState.Runtime.RenderWorkflowRunID)
	if !ok {
		t.Fatalf("expected workflow run %q to be persisted", runtimeState.Runtime.RenderWorkflowRunID)
	}
	if got := run.WorkflowType; got != "preview.render_assembly" {
		t.Fatalf("expected workflow_type %q, got %q", "preview.render_assembly", got)
	}
	if got := run.ProjectID; got != fixture.ProjectID {
		t.Fatalf("expected workflow project %q, got %q", fixture.ProjectID, got)
	}
	if got := run.Status; got != workflow.StatusPending {
		t.Fatalf("expected workflow status %q, got %q", workflow.StatusPending, got)
	}
}

func TestRequestPreviewRenderRejectsEmptyAssembly(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	_, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
	})
	if err == nil {
		t.Fatalf("expected RequestPreviewRender to reject empty assembly")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func TestRequestPreviewRenderRejectsExistingQueuedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:   fixture.ShotIDs[0],
				Sequence: 1,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	first, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "zh-CN",
	})
	if err != nil {
		t.Fatalf("first RequestPreviewRender returned error: %v", err)
	}
	if got := first.Runtime.RenderStatus; got != "queued" {
		t.Fatalf("expected first render status %q, got %q", "queued", got)
	}

	_, err = service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "en-US",
	})
	if err == nil {
		t.Fatalf("expected duplicate RequestPreviewRender to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func TestRequestPreviewRenderClearsExistingRuntimeOutputsAndErrors(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	assembly, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
				Sequence:       1,
			},
		},
	})
	if err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	now := time.Now().UTC()
	existingRuntimeID := store.GeneratePreviewRuntimeID()
	if err := store.SavePreviewRuntime(ctx, project.PreviewRuntime{
		ID:                  existingRuntimeID,
		ProjectID:           fixture.ProjectID,
		EpisodeID:           fixture.EpisodeID,
		AssemblyID:          assembly.Assembly.ID,
		Status:              "failed",
		RenderWorkflowRunID: "workflow-run-stale",
		RenderStatus:        "failed",
		PlaybackAssetID:     "playback-asset-stale",
		ExportAssetID:       "export-asset-stale",
		ResolvedLocale:      "zh-CN",
		Playback: project.PreviewPlaybackDelivery{
			DeliveryMode: "file",
			PlaybackURL:  "https://cdn.example.com/preview-old.mp4",
			PosterURL:    "https://cdn.example.com/poster-old.jpg",
			DurationMs:   42000,
			Timeline: project.PreviewTimelineSpine{
				Segments: []project.PreviewTimelineSegment{
					{
						SegmentID:       "segment-stale-1",
						Sequence:        1,
						ShotID:          fixture.ShotIDs[0],
						ShotCode:        fixture.ShotCodeByID[fixture.ShotIDs[0]],
						ShotTitle:       fixture.ShotTitleByID[fixture.ShotIDs[0]],
						PlaybackAssetID: "playback-asset-stale",
						SourceRunID:     fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
						StartMs:         0,
						DurationMs:      42000,
					},
				},
				TotalDurationMs: 42000,
			},
		},
		ExportOutput: project.PreviewExportDelivery{
			DownloadURL: "https://cdn.example.com/export-old.mp4",
			MimeType:    "video/mp4",
			FileName:    "preview-old.mp4",
			SizeBytes:   2048,
		},
		LastErrorCode:    "preview_runtime_failed",
		LastErrorMessage: "stale failure",
		CreatedAt:        now,
		UpdatedAt:        now,
	}); err != nil {
		t.Fatalf("SavePreviewRuntime returned error: %v", err)
	}

	runtimeState, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}
	if got := runtimeState.Runtime.ID; got != existingRuntimeID {
		t.Fatalf("expected existing runtime %q to be reused, got %q", existingRuntimeID, got)
	}
	if got := runtimeState.Runtime.Status; got != "queued" {
		t.Fatalf("expected runtime status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.RenderStatus; got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.PlaybackAssetID; got != "" {
		t.Fatalf("expected playback_asset_id to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.ExportAssetID; got != "" {
		t.Fatalf("expected export_asset_id to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.Playback.PlaybackURL; got != "" {
		t.Fatalf("expected playback url to be cleared, got %q", got)
	}
	if got := len(runtimeState.Runtime.Playback.Timeline.Segments); got != 0 {
		t.Fatalf("expected playback timeline segments to be cleared, got %d", got)
	}
	if got := runtimeState.Runtime.Playback.Timeline.TotalDurationMs; got != 0 {
		t.Fatalf("expected playback timeline total duration to be cleared, got %d", got)
	}
	if got := runtimeState.Runtime.ExportOutput.DownloadURL; got != "" {
		t.Fatalf("expected export download url to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.LastErrorCode; got != "" {
		t.Fatalf("expected last_error_code to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.LastErrorMessage; got != "" {
		t.Fatalf("expected last_error_message to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.ResolvedLocale; got != "en-US" {
		t.Fatalf("expected resolved locale %q, got %q", "en-US", got)
	}
}

func TestApplyPreviewRenderUpdateTransitionsRuntimeAcrossRunningCompletedAndFailed(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:         fixture.ShotIDs[0],
				PrimaryAssetID: fixture.AssetIDByShotID[fixture.ShotIDs[0]],
				SourceRunID:    fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
				Sequence:       1,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	queued, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "en-US",
	})
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}

	running, err := service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "running",
		ResolvedLocale:      "en-US",
	})
	if err != nil {
		t.Fatalf("ApplyPreviewRenderUpdate(running) returned error: %v", err)
	}
	if got := running.Runtime.Status; got != "running" {
		t.Fatalf("expected runtime status %q, got %q", "running", got)
	}
	if got := running.Runtime.RenderStatus; got != "running" {
		t.Fatalf("expected render status %q, got %q", "running", got)
	}

	completed, err := service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
		ResolvedLocale:      "en-US",
		PlaybackAssetID:     "playback-asset-1",
		ExportAssetID:       "export-asset-1",
		Playback: project.PreviewPlaybackDelivery{
			DeliveryMode: "manifest",
			PlaybackURL:  "https://cdn.example.com/preview-runtime-1.m3u8",
			PosterURL:    "https://cdn.example.com/preview-runtime-1.jpg",
			DurationMs:   30000,
			Timeline: project.PreviewTimelineSpine{
				Segments: []project.PreviewTimelineSegment{
					{
						SegmentID:       "segment-1",
						Sequence:        1,
						ShotID:          fixture.ShotIDs[0],
						ShotCode:        fixture.ShotCodeByID[fixture.ShotIDs[0]],
						ShotTitle:       fixture.ShotTitleByID[fixture.ShotIDs[0]],
						PlaybackAssetID: "playback-asset-1",
						SourceRunID:     fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
						StartMs:         0,
						DurationMs:      15000,
						TransitionToNext: &project.PreviewTransition{
							TransitionType: "cut",
							DurationMs:     500,
						},
					},
					{
						SegmentID:       "segment-2",
						Sequence:        2,
						ShotID:          fixture.ShotIDs[1],
						ShotCode:        fixture.ShotCodeByID[fixture.ShotIDs[1]],
						ShotTitle:       fixture.ShotTitleByID[fixture.ShotIDs[1]],
						PlaybackAssetID: "playback-asset-2",
						SourceRunID:     fixture.LatestRunIDByShotID[fixture.ShotIDs[1]],
						StartMs:         15000,
						DurationMs:      15000,
					},
				},
				TotalDurationMs: 30000,
			},
		},
		ExportOutput: project.PreviewExportDelivery{
			DownloadURL: "https://cdn.example.com/preview-export-1.mp4",
			MimeType:    "video/mp4",
			FileName:    "preview-export-1.mp4",
			SizeBytes:   4096,
		},
	})
	if err != nil {
		t.Fatalf("ApplyPreviewRenderUpdate(completed) returned error: %v", err)
	}
	if got := completed.Runtime.Status; got != "ready" {
		t.Fatalf("expected runtime status %q, got %q", "ready", got)
	}
	if got := completed.Runtime.RenderStatus; got != "completed" {
		t.Fatalf("expected render status %q, got %q", "completed", got)
	}
	if got := completed.Runtime.Playback.DeliveryMode; got != "manifest" {
		t.Fatalf("expected delivery mode %q, got %q", "manifest", got)
	}
	if got := completed.Runtime.Playback.PlaybackURL; got != "https://cdn.example.com/preview-runtime-1.m3u8" {
		t.Fatalf("expected playback url to round-trip, got %q", got)
	}
	if got := completed.Runtime.Playback.Timeline.TotalDurationMs; got != 30000 {
		t.Fatalf("expected playback timeline total duration %d, got %d", 30000, got)
	}
	if got := len(completed.Runtime.Playback.Timeline.Segments); got != 2 {
		t.Fatalf("expected 2 playback timeline segments, got %d", got)
	}
	if got := completed.Runtime.Playback.Timeline.Segments[0].ShotID; got != fixture.ShotIDs[0] {
		t.Fatalf("expected first timeline segment shot %q, got %q", fixture.ShotIDs[0], got)
	}
	if completed.Runtime.Playback.Timeline.Segments[0].TransitionToNext == nil {
		t.Fatalf("expected first timeline segment transition summary")
	}
	if got := completed.Runtime.Playback.Timeline.Segments[0].TransitionToNext.TransitionType; got != "cut" {
		t.Fatalf("expected first timeline transition type %q, got %q", "cut", got)
	}
	if got := completed.Runtime.Playback.Timeline.Segments[1].StartMs; got != 15000 {
		t.Fatalf("expected second timeline segment start %d, got %d", 15000, got)
	}
	if got := completed.Runtime.ExportOutput.DownloadURL; got != "https://cdn.example.com/preview-export-1.mp4" {
		t.Fatalf("expected export download url to round-trip, got %q", got)
	}
	if got := completed.Runtime.LastErrorCode; got != "" {
		t.Fatalf("expected last_error_code to stay empty, got %q", got)
	}

	failed, err := service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "failed",
		ErrorCode:           "preview_render_failed",
		ErrorMessage:        "provider timeout",
	})
	if err != nil {
		t.Fatalf("ApplyPreviewRenderUpdate(failed) returned error: %v", err)
	}
	if got := failed.Runtime.Status; got != "failed" {
		t.Fatalf("expected runtime status %q, got %q", "failed", got)
	}
	if got := failed.Runtime.RenderStatus; got != "failed" {
		t.Fatalf("expected render status %q, got %q", "failed", got)
	}
	if got := failed.Runtime.LastErrorCode; got != "preview_render_failed" {
		t.Fatalf("expected last_error_code %q, got %q", "preview_render_failed", got)
	}
	if got := failed.Runtime.LastErrorMessage; got != "provider timeout" {
		t.Fatalf("expected last_error_message %q, got %q", "provider timeout", got)
	}
}

func TestApplyPreviewRenderUpdateRejectsCompletedWithoutOutputsAndStaleWorkflowRuns(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:   fixture.ShotIDs[0],
				Sequence: 1,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	queued, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "zh-CN",
	})
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}

	_, err = service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
		ResolvedLocale:      "zh-CN",
	})
	if err == nil {
		t.Fatalf("expected completed update without outputs to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition for missing outputs, got %v", err)
	}

	_, err = service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
		ResolvedLocale:      "zh-CN",
		PlaybackAssetID:     "playback-asset-1",
		Playback: project.PreviewPlaybackDelivery{
			DeliveryMode: "hls-live",
			PlaybackURL:  "https://cdn.example.com/runtime-1.m3u8",
		},
	})
	if err == nil {
		t.Fatalf("expected completed update with invalid delivery_mode to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "invalid argument") {
		t.Fatalf("expected invalid argument for invalid delivery mode, got %v", err)
	}

	_, err = service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
		PreviewRuntimeID:    queued.Runtime.ID,
		RenderWorkflowRunID: "workflow-run-stale",
		RenderStatus:        "running",
	})
	if err == nil {
		t.Fatalf("expected stale workflow run update to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition for stale workflow run, got %v", err)
	}
}

func TestApplyPreviewRenderUpdateRejectsInvalidTimelineSpine(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	fixture := seedPreviewProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertPreviewAssembly(ctx, UpsertPreviewAssemblyInput{
		ProjectID: fixture.ProjectID,
		EpisodeID: fixture.EpisodeID,
		Status:    "ready",
		Items: []PreviewAssemblyItemInput{
			{
				ShotID:   fixture.ShotIDs[0],
				Sequence: 1,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	queued, err := service.RequestPreviewRender(ctx, RequestPreviewRenderInput{
		ProjectID:       fixture.ProjectID,
		EpisodeID:       fixture.EpisodeID,
		RequestedLocale: "zh-CN",
	})
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}

	validBase := project.PreviewPlaybackDelivery{
		DeliveryMode: "file",
		PlaybackURL:  "https://cdn.example.com/runtime-1.mp4",
		DurationMs:   30000,
		Timeline: project.PreviewTimelineSpine{
			Segments: []project.PreviewTimelineSegment{
				{
					SegmentID:       "segment-1",
					Sequence:        1,
					ShotID:          fixture.ShotIDs[0],
					ShotCode:        fixture.ShotCodeByID[fixture.ShotIDs[0]],
					ShotTitle:       fixture.ShotTitleByID[fixture.ShotIDs[0]],
					PlaybackAssetID: "playback-asset-1",
					SourceRunID:     fixture.LatestRunIDByShotID[fixture.ShotIDs[0]],
					StartMs:         0,
					DurationMs:      15000,
					TransitionToNext: &project.PreviewTransition{
						TransitionType: "cut",
						DurationMs:     400,
					},
				},
				{
					SegmentID:       "segment-2",
					Sequence:        2,
					ShotID:          fixture.ShotIDs[1],
					ShotCode:        fixture.ShotCodeByID[fixture.ShotIDs[1]],
					ShotTitle:       fixture.ShotTitleByID[fixture.ShotIDs[1]],
					PlaybackAssetID: "playback-asset-2",
					SourceRunID:     fixture.LatestRunIDByShotID[fixture.ShotIDs[1]],
					StartMs:         15000,
					DurationMs:      15000,
				},
			},
			TotalDurationMs: 30000,
		},
	}

	cases := []struct {
		name     string
		playback project.PreviewPlaybackDelivery
	}{
		{
			name: "missing segments",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-empty.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					TotalDurationMs: 1000,
				},
			},
		},
		{
			name: "sequence not contiguous",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-gap.mp4",
				DurationMs:   30000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-gap",
							Sequence:   2,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    0,
							DurationMs: 30000,
						},
					},
					TotalDurationMs: 30000,
				},
			},
		},
		{
			name: "start out of order",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-overlap.mp4",
				DurationMs:   30000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    0,
							DurationMs: 15000,
						},
						{
							SegmentID:  "segment-2",
							Sequence:   2,
							ShotID:     fixture.ShotIDs[1],
							StartMs:    14000,
							DurationMs: 16000,
						},
					},
					TotalDurationMs: 30000,
				},
			},
		},
		{
			name: "total duration mismatch",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-total.mp4",
				DurationMs:   30000,
				Timeline: project.PreviewTimelineSpine{
					Segments:        validBase.Timeline.Segments,
					TotalDurationMs: 25000,
				},
			},
		},
		{
			name: "negative start offset",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-negative-start.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    -500,
							DurationMs: 1000,
						},
					},
					TotalDurationMs: 500,
				},
			},
		},
		{
			name: "negative total duration",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-negative-total.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    -2000,
							DurationMs: 1000,
						},
					},
					TotalDurationMs: -1000,
				},
			},
		},
		{
			name: "missing shot id",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-shot.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							StartMs:    0,
							DurationMs: 1000,
						},
					},
					TotalDurationMs: 1000,
				},
			},
		},
		{
			name: "transition missing type",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-transition.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    0,
							DurationMs: 1000,
							TransitionToNext: &project.PreviewTransition{
								DurationMs: 200,
							},
						},
					},
					TotalDurationMs: 1000,
				},
			},
		},
		{
			name: "transition non-positive duration",
			playback: project.PreviewPlaybackDelivery{
				DeliveryMode: "file",
				PlaybackURL:  "https://cdn.example.com/runtime-transition-duration.mp4",
				DurationMs:   1000,
				Timeline: project.PreviewTimelineSpine{
					Segments: []project.PreviewTimelineSegment{
						{
							SegmentID:  "segment-1",
							Sequence:   1,
							ShotID:     fixture.ShotIDs[0],
							StartMs:    0,
							DurationMs: 1000,
							TransitionToNext: &project.PreviewTransition{
								TransitionType: "cut",
							},
						},
					},
					TotalDurationMs: 1000,
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.ApplyPreviewRenderUpdate(ctx, ApplyPreviewRenderUpdateInput{
				PreviewRuntimeID:    queued.Runtime.ID,
				RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
				RenderStatus:        "completed",
				ResolvedLocale:      "zh-CN",
				PlaybackAssetID:     "playback-asset-1",
				Playback:            tc.playback,
			})
			if err == nil {
				t.Fatalf("expected invalid timeline spine to fail")
			}
			if !strings.Contains(strings.ToLower(err.Error()), "invalid argument") {
				t.Fatalf("expected invalid argument error, got %v", err)
			}
		})
	}
}

type previewFixture struct {
	ProjectID           string
	EpisodeID           string
	ShotIDs             []string
	SceneIDByShotID     map[string]string
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
	sceneIDByShotID := make(map[string]string, 3)
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
		sceneIDByShotID[shotID] = sceneIDs[index-1]
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
		SceneIDByShotID:     sceneIDByShotID,
		ShotCodeByID:        shotCodeByID,
		ShotTitleByID:       shotTitleByID,
		ExecutionIDByShotID: executionIDByShotID,
		LatestRunIDByShotID: latestRunIDByShotID,
		AssetIDByShotID:     assetIDByShotID,
	}
}
