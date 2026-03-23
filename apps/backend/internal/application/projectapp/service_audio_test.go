package projectapp

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAudioWorkbenchLifecycle(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, workflowRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	initial, err := service.GetAudioWorkbench(ctx, GetAudioWorkbenchInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("GetAudioWorkbench returned error: %v", err)
	}
	if got := initial.Timeline.ProjectID; got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}
	if got := len(initial.Tracks); got != 0 {
		t.Fatalf("expected empty audio workbench, got %d tracks", got)
	}

	updated, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		Status:              "ready",
		RenderWorkflowRunID: workflowRunID,
		RenderStatus:        "queued",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      2,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: workflowRunID,
						Sequence:    2,
						StartMs:     1000,
						DurationMs:  10000,
						TrimInMs:    100,
						TrimOutMs:   200,
					},
				},
			},
			{
				TrackType:     "voiceover",
				DisplayName:   "旁白",
				Sequence:      1,
				Muted:         true,
				VolumePercent: 80,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["voiceover"],
						SourceRunID: workflowRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
						TrimInMs:    0,
						TrimOutMs:   0,
					},
				},
			},
			{
				TrackType:     "bgm",
				DisplayName:   "配乐",
				Sequence:      3,
				Solo:          true,
				VolumePercent: 65,
				Clips: []AudioClipInput{
					{
						AssetID:    assetIDs["bgm"],
						Sequence:   1,
						StartMs:    0,
						DurationMs: 30000,
						TrimInMs:   0,
						TrimOutMs:  500,
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}
	if got := updated.Timeline.RenderWorkflowRunID; got != workflowRunID {
		t.Fatalf("expected render workflow run %q, got %q", workflowRunID, got)
	}
	if got := updated.Timeline.RenderStatus; got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := len(updated.Tracks); got != 3 {
		t.Fatalf("expected 3 tracks, got %d", got)
	}
	if got := updated.Tracks[0].TrackType; got != "voiceover" {
		t.Fatalf("expected first track type %q, got %q", "voiceover", got)
	}
	if got := updated.Tracks[1].TrackType; got != "dialogue" {
		t.Fatalf("expected second track type %q, got %q", "dialogue", got)
	}
	if got := updated.Tracks[2].TrackType; got != "bgm" {
		t.Fatalf("expected third track type %q, got %q", "bgm", got)
	}
	if got := updated.Tracks[1].Clips[0].DurationMs; got != 10000 {
		t.Fatalf("expected dialogue duration %d, got %d", 10000, got)
	}

	readback, err := service.GetAudioWorkbench(ctx, GetAudioWorkbenchInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("GetAudioWorkbench readback returned error: %v", err)
	}
	if got := readback.Tracks[0].TrackType; got != "voiceover" {
		t.Fatalf("expected persisted first track %q, got %q", "voiceover", got)
	}
	if got := readback.Tracks[1].Clips[0].AssetID; got != assetIDs["dialogue"] {
		t.Fatalf("expected persisted dialogue asset %q, got %q", assetIDs["dialogue"], got)
	}
}

func TestAudioWorkbenchRejectsUnknownAsset(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, _, _ := seedAudioProject(t, ctx, store)
	service := NewService(store)

	_, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:    "missing-asset",
						Sequence:   1,
						StartMs:    0,
						DurationMs: 1000,
					},
				},
			},
		},
	})
	if err == nil {
		t.Fatalf("expected UpsertAudioTimeline to reject missing asset")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestAudioWorkbenchRejectsCrossProjectSourceRun(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, _ := seedAudioProject(t, ctx, store)
	service := NewService(store)

	otherProjectID := store.GenerateProjectID()
	now := time.Now().UTC()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   otherProjectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-2",
		Title:                "其他项目",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject other returned error: %v", err)
	}

	foreignRunID := store.GenerateWorkflowRunID()
	if err := store.SaveWorkflowRun(ctx, workflow.WorkflowRun{
		ID:           foreignRunID,
		OrgID:        "org-1",
		ProjectID:    otherProjectID,
		WorkflowType: "audio.render_mix",
		ResourceID:   "timeline-foreign",
		Status:       "running",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun foreign returned error: %v", err)
	}

	_, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Tracks: []AudioTrackInput{
			{
				TrackType:     "bgm",
				DisplayName:   "配乐",
				Sequence:      1,
				VolumePercent: 60,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["bgm"],
						SourceRunID: foreignRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  1000,
					},
				},
			},
		},
	})
	if err == nil {
		t.Fatalf("expected UpsertAudioTimeline to reject cross-project source_run_id")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func seedAudioProject(t *testing.T, ctx context.Context, store *db.MemoryStore) (string, string, map[string]string, string) {
	t.Helper()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, project.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "音频项目",
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

	assetIDs := make(map[string]string)
	for _, trackType := range []string{"dialogue", "voiceover", "bgm"} {
		assetID := store.GenerateMediaAssetID()
		assetIDs[trackType] = assetID
		if err := store.SaveMediaAsset(ctx, asset.MediaAsset{
			ID:            assetID,
			OrgID:         "org-1",
			ProjectID:     projectID,
			ImportBatchID: "",
			MediaType:     "audio",
			SourceType:    "workflow_import",
			Locale:        "zh-CN",
			RightsStatus:  "clear",
			AIAnnotated:   trackType != "bgm",
			CreatedAt:     now,
			UpdatedAt:     now,
		}); err != nil {
			t.Fatalf("SaveMediaAsset(%s) returned error: %v", trackType, err)
		}
	}

	workflowRunID := store.GenerateWorkflowRunID()
	if err := store.SaveWorkflowRun(ctx, workflow.WorkflowRun{
		ID:           workflowRunID,
		OrgID:        "org-1",
		ProjectID:    projectID,
		WorkflowType: "audio.render_mix",
		ResourceID:   fmt.Sprintf("audio-timeline-%s", projectID),
		Status:       "queued",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}

	return projectID, episodeID, assetIDs, workflowRunID
}
