package projectapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestGetAudioRuntimeAutoCreatesProjectScopedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, _, _, _ := seedAudioProject(t, ctx, store)
	service := NewService(store)

	runtimeState, err := service.GetAudioRuntime(ctx, GetAudioRuntimeInput{
		ProjectID: projectID,
	})
	if err != nil {
		t.Fatalf("GetAudioRuntime returned error: %v", err)
	}
	if got := runtimeState.Runtime.ProjectID; got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}
	if got := runtimeState.Runtime.EpisodeID; got != "" {
		t.Fatalf("expected project-only runtime episode_id to stay empty, got %q", got)
	}
	if got := runtimeState.Runtime.Status; got != "draft" {
		t.Fatalf("expected status %q, got %q", "draft", got)
	}
	if got := runtimeState.Runtime.RenderStatus; got != "idle" {
		t.Fatalf("expected render status %q, got %q", "idle", got)
	}
	if got := runtimeState.Runtime.AudioTimelineID; got == "" {
		t.Fatalf("expected audio timeline id to be populated")
	}
	if _, ok, err := store.GetAudioRuntime(projectID, ""); err != nil {
		t.Fatalf("GetAudioRuntime returned error: %v", err)
	} else if !ok {
		t.Fatalf("expected project-scoped audio runtime to be persisted")
	}
}

func TestGetAudioRuntimeAutoCreatesEpisodeScopedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, _, _ := seedAudioProject(t, ctx, store)
	service := NewService(store)

	runtimeState, err := service.GetAudioRuntime(ctx, GetAudioRuntimeInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("GetAudioRuntime returned error: %v", err)
	}
	if got := runtimeState.Runtime.EpisodeID; got != episodeID {
		t.Fatalf("expected episode %q, got %q", episodeID, got)
	}
	if got := runtimeState.Runtime.AudioTimelineID; got == "" {
		t.Fatalf("expected episode-scoped audio timeline id to be populated")
	}
}

func TestRequestAudioRenderQueuesWorkflowRunForNonEmptyTimeline(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	runtimeState, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}
	if got := runtimeState.Runtime.Status; got != "queued" {
		t.Fatalf("expected status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.RenderStatus; got != "queued" {
		t.Fatalf("expected render status %q, got %q", "queued", got)
	}
	if got := runtimeState.Runtime.RenderWorkflowRunID; got == "" {
		t.Fatalf("expected render workflow run id to be populated")
	}
	if got := runtimeState.Runtime.MixAssetID; got != "" {
		t.Fatalf("expected mix asset id to be cleared on queue, got %q", got)
	}
	if got := len(runtimeState.Runtime.Waveforms); got != 0 {
		t.Fatalf("expected waveforms to be cleared on queue, got %d", got)
	}
}

func TestRequestAudioRenderRejectsEmptyTimeline(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, _, _ := seedAudioProject(t, ctx, store)
	service := NewService(store)

	_, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err == nil {
		t.Fatalf("expected RequestAudioRender to reject empty timeline")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func TestRequestAudioRenderRejectsExistingQueuedRuntime(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "bgm",
				DisplayName:   "配乐",
				Sequence:      1,
				VolumePercent: 80,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["bgm"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  30000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	first, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("first RequestAudioRender returned error: %v", err)
	}
	if got := first.Runtime.RenderStatus; got != "queued" {
		t.Fatalf("expected first render status %q, got %q", "queued", got)
	}

	_, err = service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err == nil {
		t.Fatalf("expected duplicate RequestAudioRender to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func TestRequestAudioRenderClearsExistingRuntimeOutputsAndErrors(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  1000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	existingRuntimeID := store.GenerateAudioRuntimeID()
	now := time.Now().UTC()
	if err := store.SaveAudioRuntime(ctx, project.AudioRuntime{
		ID:                  existingRuntimeID,
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		AudioTimelineID:     "audio-timeline-existing",
		Status:              "failed",
		RenderWorkflowRunID: "workflow-run-stale",
		RenderStatus:        "failed",
		MixAssetID:          "mix-asset-stale",
		MixOutput: project.AudioMixDelivery{
			DeliveryMode: "file",
			PlaybackURL:  "https://cdn.example.com/stale.mp3",
			DownloadURL:  "https://cdn.example.com/stale-download.mp3",
			MimeType:     "audio/mpeg",
			FileName:     "stale.mp3",
			SizeBytes:    1024,
			DurationMs:   12000,
		},
		Waveforms: []project.AudioWaveformReference{
			{
				AssetID:     assetIDs["dialogue"],
				VariantID:   "variant-stale",
				WaveformURL: "https://cdn.example.com/stale-waveform.json",
				MimeType:    "application/json",
				DurationMs:  12000,
			},
		},
		LastErrorCode:    "audio_render_failed",
		LastErrorMessage: "stale failure",
		CreatedAt:        now,
		UpdatedAt:        now,
	}); err != nil {
		t.Fatalf("SaveAudioRuntime returned error: %v", err)
	}

	runtimeState, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}
	if got := runtimeState.Runtime.ID; got != existingRuntimeID {
		t.Fatalf("expected existing runtime id %q, got %q", existingRuntimeID, got)
	}
	if got := runtimeState.Runtime.MixOutput; got != (project.AudioMixDelivery{}) {
		t.Fatalf("expected mix output to be cleared, got %#v", got)
	}
	if got := len(runtimeState.Runtime.Waveforms); got != 0 {
		t.Fatalf("expected waveforms to be cleared, got %d", got)
	}
	if got := runtimeState.Runtime.LastErrorCode; got != "" {
		t.Fatalf("expected last error code to be cleared, got %q", got)
	}
	if got := runtimeState.Runtime.LastErrorMessage; got != "" {
		t.Fatalf("expected last error message to be cleared, got %q", got)
	}
}

func TestApplyAudioRenderUpdateTransitionsRuntimeAcrossRunningCompletedAndFailed(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	queued, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}

	running, err := service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "running",
	})
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate(running) returned error: %v", err)
	}
	if got := running.Runtime.Status; got != "running" {
		t.Fatalf("expected running status %q, got %q", "running", got)
	}
	if got := running.Runtime.RenderStatus; got != "running" {
		t.Fatalf("expected running render status %q, got %q", "running", got)
	}

	completed, err := service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
		MixAssetID:          "mix-asset-1",
		MixOutput: project.AudioMixDelivery{
			DeliveryMode: "file",
			PlaybackURL:  "https://cdn.example.com/mix-1.mp3",
			DownloadURL:  "https://cdn.example.com/mix-1-download.mp3",
			MimeType:     "audio/mpeg",
			FileName:     "mix-1.mp3",
			SizeBytes:    4096,
			DurationMs:   12000,
		},
		Waveforms: []project.AudioWaveformReference{
			{
				AssetID:     assetIDs["dialogue"],
				VariantID:   "waveform-variant-1",
				WaveformURL: "https://cdn.example.com/waveform-1.json",
				MimeType:    "application/json",
				DurationMs:  12000,
			},
		},
	})
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate(completed) returned error: %v", err)
	}
	if got := completed.Runtime.Status; got != "ready" {
		t.Fatalf("expected completed status %q, got %q", "ready", got)
	}
	if got := completed.Runtime.RenderStatus; got != "completed" {
		t.Fatalf("expected completed render status %q, got %q", "completed", got)
	}
	if got := completed.Runtime.MixAssetID; got != "mix-asset-1" {
		t.Fatalf("expected mix asset id %q, got %q", "mix-asset-1", got)
	}
	if got := completed.Runtime.MixOutput.PlaybackURL; got != "https://cdn.example.com/mix-1.mp3" {
		t.Fatalf("expected playback url %q, got %q", "https://cdn.example.com/mix-1.mp3", got)
	}
	if got := len(completed.Runtime.Waveforms); got != 1 {
		t.Fatalf("expected 1 waveform reference, got %d", got)
	}
	if got := completed.Runtime.Waveforms[0].WaveformURL; got != "https://cdn.example.com/waveform-1.json" {
		t.Fatalf("expected waveform url %q, got %q", "https://cdn.example.com/waveform-1.json", got)
	}

	failed, err := service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "failed",
		ErrorCode:           "audio_render_failed",
		ErrorMessage:        "mixdown failed",
	})
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate(failed) returned error: %v", err)
	}
	if got := failed.Runtime.Status; got != "failed" {
		t.Fatalf("expected failed status %q, got %q", "failed", got)
	}
	if got := failed.Runtime.LastErrorCode; got != "audio_render_failed" {
		t.Fatalf("expected last error code %q, got %q", "audio_render_failed", got)
	}
	if got := failed.Runtime.LastErrorMessage; got != "mixdown failed" {
		t.Fatalf("expected last error message %q, got %q", "mixdown failed", got)
	}
}

func TestApplyAudioRenderUpdateRejectsCompletedWithoutOutputsAndStaleWorkflowRuns(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	queued, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}

	_, err = service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
	})
	if err == nil {
		t.Fatalf("expected completed update without mix output to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}

	_, err = service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: "workflow-run-stale",
		RenderStatus:        "running",
	})
	if err == nil {
		t.Fatalf("expected stale workflow run update to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
}

func TestApplyAudioRenderUpdateRejectsInvalidWaveformReferences(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectID, episodeID, assetIDs, sourceRunID := seedAudioProject(t, ctx, store)
	service := NewService(store)

	if _, err := service.UpsertAudioTimeline(ctx, UpsertAudioTimelineInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "ready",
		Tracks: []AudioTrackInput{
			{
				TrackType:     "dialogue",
				DisplayName:   "对白",
				Sequence:      1,
				VolumePercent: 100,
				Clips: []AudioClipInput{
					{
						AssetID:     assetIDs["dialogue"],
						SourceRunID: sourceRunID,
						Sequence:    1,
						StartMs:     0,
						DurationMs:  12000,
					},
				},
			},
		},
	}); err != nil {
		t.Fatalf("UpsertAudioTimeline returned error: %v", err)
	}

	queued, err := service.RequestAudioRender(ctx, RequestAudioRenderInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err != nil {
		t.Fatalf("RequestAudioRender returned error: %v", err)
	}

	_, err = service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      queued.Runtime.ID,
		RenderWorkflowRunID: queued.Runtime.RenderWorkflowRunID,
		RenderStatus:        "completed",
		MixAssetID:          "mix-asset-1",
		MixOutput: project.AudioMixDelivery{
			DeliveryMode: "file",
			PlaybackURL:  "https://cdn.example.com/mix-1.mp3",
		},
		Waveforms: []project.AudioWaveformReference{
			{
				AssetID:     assetIDs["dialogue"],
				WaveformURL: "https://cdn.example.com/waveform-1.json",
			},
		},
	})
	if err == nil {
		t.Fatalf("expected waveform validation to fail")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "invalid argument") {
		t.Fatalf("expected invalid argument error, got %v", err)
	}
}

func TestApplyAudioRenderUpdateUsesAtomicAudioRuntimeWorkflowSave(t *testing.T) {
	ctx := context.Background()
	store := &audioRuntimeRepoDouble{MemoryStore: db.NewMemoryStore()}
	projectID, episodeID, _, _ := seedAudioProject(t, ctx, store.MemoryStore)
	service := NewService(store)

	now := time.Now().UTC()
	runtimeRecord := project.AudioRuntime{
		ID:                  store.GenerateAudioRuntimeID(),
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		AudioTimelineID:     store.GenerateAudioTimelineID(),
		Status:              "queued",
		RenderWorkflowRunID: store.GenerateWorkflowRunID(),
		RenderStatus:        "queued",
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if err := store.MemoryStore.SaveAudioRuntime(ctx, runtimeRecord); err != nil {
		t.Fatalf("SaveAudioRuntime returned error: %v", err)
	}
	workflowRun := workflow.WorkflowRun{
		ID:           runtimeRecord.RenderWorkflowRunID,
		OrgID:        db.DefaultDevOrganizationID,
		ProjectID:    projectID,
		ResourceID:   runtimeRecord.ID,
		WorkflowType: "audio.render_mix",
		Status:       workflow.StatusPending,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := store.MemoryStore.SaveWorkflowRun(ctx, workflowRun); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}

	store.disallowDirectRuntimeSave = true
	store.disallowDirectWorkflowSave = true

	updated, err := service.ApplyAudioRenderUpdate(ctx, ApplyAudioRenderUpdateInput{
		AudioRuntimeID:      runtimeRecord.ID,
		RenderWorkflowRunID: runtimeRecord.RenderWorkflowRunID,
		RenderStatus:        "running",
	})
	if err != nil {
		t.Fatalf("ApplyAudioRenderUpdate returned error: %v", err)
	}
	if !store.atomicSaveCalled {
		t.Fatalf("expected ApplyAudioRenderUpdate to use atomic audio runtime + workflow save")
	}
	if got := updated.Runtime.Status; got != "running" {
		t.Fatalf("expected runtime status %q, got %q", "running", got)
	}

	storedRuntime, ok, err := store.GetAudioRuntimeByID(runtimeRecord.ID)
	if err != nil {
		t.Fatalf("GetAudioRuntimeByID returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected runtime %q to remain persisted", runtimeRecord.ID)
	}
	if got := storedRuntime.RenderStatus; got != "running" {
		t.Fatalf("expected stored render status %q, got %q", "running", got)
	}

	storedRun, ok := store.GetWorkflowRun(runtimeRecord.RenderWorkflowRunID)
	if !ok {
		t.Fatalf("expected workflow run %q to remain persisted", runtimeRecord.RenderWorkflowRunID)
	}
	if got := storedRun.Status; got != workflow.StatusRunning {
		t.Fatalf("expected stored workflow status %q, got %q", workflow.StatusRunning, got)
	}
}

func TestGetAudioRuntimePropagatesLookupErrorsWithoutAutoCreate(t *testing.T) {
	ctx := context.Background()
	store := &audioRuntimeRepoDouble{
		MemoryStore: db.NewMemoryStore(),
		lookupErr:   errors.New("db: decode audio runtime waveforms: invalid character"),
	}
	projectID, episodeID, _, _ := seedAudioProject(t, ctx, store.MemoryStore)
	service := NewService(store)

	_, err := service.GetAudioRuntime(ctx, GetAudioRuntimeInput{
		ProjectID: projectID,
		EpisodeID: episodeID,
	})
	if err == nil {
		t.Fatalf("expected GetAudioRuntime to surface lookup error")
	}
	if !strings.Contains(err.Error(), "decode audio runtime waveforms") {
		t.Fatalf("expected lookup error to be preserved, got %v", err)
	}

	store.lookupErr = nil
	_, ok, err := store.GetAudioRuntime(projectID, episodeID)
	if err != nil {
		t.Fatalf("GetAudioRuntime returned error after clearing lookupErr: %v", err)
	}
	if ok {
		t.Fatalf("expected runtime not to be auto-created when lookup fails")
	}
}

type audioRuntimeRepoDouble struct {
	*db.MemoryStore
	lookupErr                  error
	lookupByIDErr              error
	disallowDirectRuntimeSave  bool
	disallowDirectWorkflowSave bool
	atomicSaveCalled           bool
}

func (s *audioRuntimeRepoDouble) GetAudioRuntime(projectID string, episodeID string) (project.AudioRuntime, bool, error) {
	if s.lookupErr != nil {
		return project.AudioRuntime{}, false, s.lookupErr
	}
	return s.MemoryStore.GetAudioRuntime(projectID, episodeID)
}

func (s *audioRuntimeRepoDouble) GetAudioRuntimeByID(audioRuntimeID string) (project.AudioRuntime, bool, error) {
	if s.lookupByIDErr != nil {
		return project.AudioRuntime{}, false, s.lookupByIDErr
	}
	return s.MemoryStore.GetAudioRuntimeByID(audioRuntimeID)
}

func (s *audioRuntimeRepoDouble) SaveAudioRuntime(ctx context.Context, record project.AudioRuntime) error {
	if s.disallowDirectRuntimeSave {
		return errors.New("direct SaveAudioRuntime should not be used in ApplyAudioRenderUpdate")
	}
	return s.MemoryStore.SaveAudioRuntime(ctx, record)
}

func (s *audioRuntimeRepoDouble) SaveWorkflowRun(ctx context.Context, record workflow.WorkflowRun) error {
	if s.disallowDirectWorkflowSave {
		return errors.New("direct SaveWorkflowRun should not be used in ApplyAudioRenderUpdate")
	}
	return s.MemoryStore.SaveWorkflowRun(ctx, record)
}

func (s *audioRuntimeRepoDouble) SaveAudioRuntimeAndWorkflowRun(_ context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun) error {
	s.atomicSaveCalled = true
	s.AudioRuntimes[runtimeRecord.ID] = runtimeRecord
	s.WorkflowRuns[workflowRun.ID] = workflowRun
	return nil
}
