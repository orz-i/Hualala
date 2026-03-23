package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
	assetdomain "github.com/hualala/apps/backend/internal/domain/asset"
	projectdomain "github.com/hualala/apps/backend/internal/domain/project"
	workflowdomain "github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAudioRoutesExposeProjectScopedTimeline(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, projectdomain.Project{
		ID:                   projectID,
		OrganizationID:       "org-1",
		OwnerUserID:          "user-1",
		Title:                "Audio Routes",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	episodeID := store.GenerateEpisodeID()
	if err := store.SaveEpisode(ctx, projectdomain.Episode{
		ID:        episodeID,
		ProjectID: projectID,
		EpisodeNo: 1,
		Title:     "第一集",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}
	dialogueAssetID := store.GenerateMediaAssetID()
	if err := store.SaveMediaAsset(ctx, assetdomain.MediaAsset{
		ID:           dialogueAssetID,
		OrgID:        "org-1",
		ProjectID:    projectID,
		MediaType:    "audio",
		SourceType:   "workflow_import",
		Locale:       "zh-CN",
		RightsStatus: "clear",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}
	workflowRunID := store.GenerateWorkflowRunID()
	if err := store.SaveWorkflowRun(ctx, workflowdomain.WorkflowRun{
		ID:           workflowRunID,
		OrgID:        "org-1",
		ProjectID:    projectID,
		WorkflowType: "audio.render_mix",
		ResourceID:   "audio-timeline-1",
		Status:       "queued",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)

	initial, err := projectClient.GetAudioWorkbench(ctx, connectrpc.NewRequest(&projectv1.GetAudioWorkbenchRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err != nil {
		t.Fatalf("GetAudioWorkbench returned error: %v", err)
	}
	if got := initial.Msg.GetTimeline().GetProjectId(); got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}
	if got := len(initial.Msg.GetTimeline().GetTracks()); got != 0 {
		t.Fatalf("expected empty audio timeline, got %d tracks", got)
	}

	updated, err := projectClient.UpsertAudioTimeline(ctx, connectrpc.NewRequest(&projectv1.UpsertAudioTimelineRequest{
		ProjectId:           projectID,
		EpisodeId:           episodeID,
		Status:              "ready",
		RenderWorkflowRunId: workflowRunID,
		RenderStatus:        "queued",
		Tracks: []*projectv1.AudioTrack{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []*projectv1.AudioClip{
					{
						AssetId:     dialogueAssetID,
						SourceRunId: workflowRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
						TrimInMs:    0,
						TrimOutMs:   120,
					},
				},
			},
			{
				TrackType:     "voiceover",
				DisplayName:   "旁白",
				Sequence:      2,
				Muted:         true,
				VolumePercent: 0,
			},
			{
				TrackType:     "bgm",
				DisplayName:   "配乐",
				Sequence:      3,
				Solo:          true,
				VolumePercent: 60,
			},
		},
	}))
	if err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}
	if got := len(updated.Msg.GetTimeline().GetTracks()); got != 3 {
		t.Fatalf("expected 3 audio tracks, got %d", got)
	}
	if got := updated.Msg.GetTimeline().GetRenderWorkflowRunId(); got != workflowRunID {
		t.Fatalf("expected render workflow run %q, got %q", workflowRunID, got)
	}
	if got := updated.Msg.GetTimeline().GetTracks()[1].GetVolumePercent(); got != 0 {
		t.Fatalf("expected voiceover volume %d, got %d", 0, got)
	}
	if got := updated.Msg.GetTimeline().GetTracks()[0].GetClips()[0].GetAssetId(); got != dialogueAssetID {
		t.Fatalf("expected audio clip asset %q, got %q", dialogueAssetID, got)
	}

	_, err = projectClient.GetAudioWorkbench(ctx, connectrpc.NewRequest(&projectv1.GetAudioWorkbenchRequest{
		ProjectId: "missing-project",
	}))
	if err == nil {
		t.Fatalf("expected GetAudioWorkbench to reject missing project")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeNotFound {
		t.Fatalf("expected not found, got %v", connectrpc.CodeOf(err))
	}
}
