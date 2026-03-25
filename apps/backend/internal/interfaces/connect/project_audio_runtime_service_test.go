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
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAudioRuntimeRoutesExposeQueuedRuntimeAndSSE(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, projectdomain.Project{
		ID:                   projectID,
		OrganizationID:       connectTestOrgID,
		OwnerUserID:          connectTestUserID,
		Title:                "Audio Runtime",
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
		OrgID:        connectTestOrgID,
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

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)

	initial, err := projectClient.GetAudioRuntime(ctx, connectrpc.NewRequest(&projectv1.GetAudioRuntimeRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err != nil {
		t.Fatalf("GetAudioRuntime returned error: %v", err)
	}
	if got := initial.Msg.GetRuntime().GetRenderStatus(); got != "idle" {
		t.Fatalf("expected initial render status %q, got %q", "idle", got)
	}

	if _, err := projectClient.UpsertAudioTimeline(ctx, connectrpc.NewRequest(&projectv1.UpsertAudioTimelineRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
		Status:    "ready",
		Tracks: []*projectv1.AudioTrack{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []*projectv1.AudioClip{
					{
						AssetId:    dialogueAssetID,
						Sequence:   1,
						StartMs:    0,
						DurationMs: 12000,
					},
				},
			},
		},
	})); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+connectTestOrgID+"&project_id="+projectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()
	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseResp.StatusCode)
	}

	queued, err := projectClient.RequestAudioRender(ctx, connectrpc.NewRequest(&projectv1.RequestAudioRenderRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}
	if got := queued.Msg.GetRuntime().GetRenderStatus(); got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := queued.Msg.GetRuntime().GetRenderWorkflowRunId(); got == "" {
		t.Fatalf("expected render workflow run id to be populated")
	}

	stream := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: project.audio.runtime.updated",
		`"audio_runtime_id":"`+queued.Msg.GetRuntime().GetAudioRuntimeId()+`"`,
		`"render_status":"queued"`,
	)
	if stream == "" {
		t.Fatalf("expected audio runtime SSE payload")
	}

	_, err = projectClient.RequestAudioRender(ctx, connectrpc.NewRequest(&projectv1.RequestAudioRenderRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err == nil {
		t.Fatalf("expected duplicate RequestAudioRender to fail")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeFailedPrecondition {
		t.Fatalf("expected failed precondition, got %v", connectrpc.CodeOf(err))
	}
}

func TestApplyAudioRenderUpdateRouteExposesRuntimeOutputsAndWaveforms(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, projectdomain.Project{
		ID:                   projectID,
		OrganizationID:       connectTestOrgID,
		OwnerUserID:          connectTestUserID,
		Title:                "Audio Runtime Outputs",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	dialogueAssetID := store.GenerateMediaAssetID()
	if err := store.SaveMediaAsset(ctx, assetdomain.MediaAsset{
		ID:           dialogueAssetID,
		OrgID:        connectTestOrgID,
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

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)

	if _, err := projectClient.UpsertAudioTimeline(ctx, connectrpc.NewRequest(&projectv1.UpsertAudioTimelineRequest{
		ProjectId: projectID,
		Status:    "ready",
		Tracks: []*projectv1.AudioTrack{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []*projectv1.AudioClip{
					{
						AssetId:    dialogueAssetID,
						Sequence:   1,
						StartMs:    0,
						DurationMs: 12000,
					},
				},
			},
		},
	})); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	queued, err := projectClient.RequestAudioRender(ctx, connectrpc.NewRequest(&projectv1.RequestAudioRenderRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}

	updated, err := projectClient.ApplyAudioRenderUpdate(ctx, connectrpc.NewRequest(&projectv1.ApplyAudioRenderUpdateRequest{
		AudioRuntimeId:      queued.Msg.GetRuntime().GetAudioRuntimeId(),
		RenderWorkflowRunId: queued.Msg.GetRuntime().GetRenderWorkflowRunId(),
		RenderStatus:        "completed",
		MixAssetId:          "mix-asset-1",
		MixOutput: &projectv1.AudioMixDelivery{
			DeliveryMode: "file",
			PlaybackUrl:  "https://cdn.example.com/mix-1.mp3",
			DownloadUrl:  "https://cdn.example.com/mix-1-download.mp3",
			MimeType:     "audio/mpeg",
			FileName:     "mix-1.mp3",
			SizeBytes:    4096,
			DurationMs:   12000,
		},
		Waveforms: []*projectv1.AudioWaveformReference{
			{
				AssetId:     dialogueAssetID,
				VariantId:   "waveform-variant-1",
				WaveformUrl: "https://cdn.example.com/waveform-1.json",
				MimeType:    "application/json",
				DurationMs:  12000,
			},
		},
	}))
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate returned error: %v", err)
	}
	if got := updated.Msg.GetRuntime().GetStatus(); got != "ready" {
		t.Fatalf("expected runtime status %q, got %q", "ready", got)
	}
	if got := updated.Msg.GetRuntime().GetMixAssetId(); got != "mix-asset-1" {
		t.Fatalf("expected mix asset id %q, got %q", "mix-asset-1", got)
	}
	if got := updated.Msg.GetRuntime().GetMixOutput().GetPlaybackUrl(); got != "https://cdn.example.com/mix-1.mp3" {
		t.Fatalf("expected playback url %q, got %q", "https://cdn.example.com/mix-1.mp3", got)
	}
	if got := len(updated.Msg.GetRuntime().GetWaveforms()); got != 1 {
		t.Fatalf("expected 1 waveform reference, got %d", got)
	}
	if got := updated.Msg.GetRuntime().GetWaveforms()[0].GetWaveformUrl(); got != "https://cdn.example.com/waveform-1.json" {
		t.Fatalf("expected waveform url %q, got %q", "https://cdn.example.com/waveform-1.json", got)
	}

	readback, err := projectClient.GetAudioRuntime(ctx, connectrpc.NewRequest(&projectv1.GetAudioRuntimeRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("GetAudioRuntime returned error: %v", err)
	}
	if got := readback.Msg.GetRuntime().GetMixOutput().GetMimeType(); got != "audio/mpeg" {
		t.Fatalf("expected mix output mime type %q, got %q", "audio/mpeg", got)
	}
	if got := readback.Msg.GetRuntime().GetWaveforms()[0].GetVariantId(); got != "waveform-variant-1" {
		t.Fatalf("expected waveform variant id %q, got %q", "waveform-variant-1", got)
	}
}

func TestApplyAudioRenderUpdateRouteAllowsRunningWithoutOptionalOutputs(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	now := time.Now().UTC()
	projectID := store.GenerateProjectID()
	if err := store.SaveProject(ctx, projectdomain.Project{
		ID:                   projectID,
		OrganizationID:       connectTestOrgID,
		OwnerUserID:          connectTestUserID,
		Title:                "Audio Runtime Running",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	dialogueAssetID := store.GenerateMediaAssetID()
	if err := store.SaveMediaAsset(ctx, assetdomain.MediaAsset{
		ID:           dialogueAssetID,
		OrgID:        connectTestOrgID,
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

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)

	if _, err := projectClient.UpsertAudioTimeline(ctx, connectrpc.NewRequest(&projectv1.UpsertAudioTimelineRequest{
		ProjectId: projectID,
		Status:    "ready",
		Tracks: []*projectv1.AudioTrack{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []*projectv1.AudioClip{
					{
						AssetId:    dialogueAssetID,
						Sequence:   1,
						StartMs:    0,
						DurationMs: 12000,
					},
				},
			},
		},
	})); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	queued, err := projectClient.RequestAudioRender(ctx, connectrpc.NewRequest(&projectv1.RequestAudioRenderRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}

	updated, err := projectClient.ApplyAudioRenderUpdate(ctx, connectrpc.NewRequest(&projectv1.ApplyAudioRenderUpdateRequest{
		AudioRuntimeId:      queued.Msg.GetRuntime().GetAudioRuntimeId(),
		RenderWorkflowRunId: queued.Msg.GetRuntime().GetRenderWorkflowRunId(),
		RenderStatus:        "running",
	}))
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate returned error: %v", err)
	}
	if got := updated.Msg.GetRuntime().GetStatus(); got != "running" {
		t.Fatalf("expected runtime status %q, got %q", "running", got)
	}
	if got := updated.Msg.GetRuntime().GetMixOutput(); got != nil {
		t.Fatalf("expected mix output to stay nil, got %#v", got)
	}
	if got := len(updated.Msg.GetRuntime().GetWaveforms()); got != 0 {
		t.Fatalf("expected waveform list to stay empty, got %d", got)
	}
}
