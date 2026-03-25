package projectapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

const (
	audioRuntimeStatusDraft    = "draft"
	audioRuntimeStatusQueued   = "queued"
	audioRuntimeStatusRunning  = "running"
	audioRuntimeStatusReady    = "ready"
	audioRuntimeStatusFailed   = "failed"
	audioRenderStatusIdle      = "idle"
	audioRenderStatusQueued    = "queued"
	audioRenderStatusRunning   = "running"
	audioRenderStatusCompleted = "completed"
	audioRenderStatusFailed    = "failed"
)

func (s *Service) GetAudioRuntime(ctx context.Context, input GetAudioRuntimeInput) (AudioRuntimeState, error) {
	if s == nil || s.repo == nil {
		return AudioRuntimeState{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	timeline, err := s.ensureAudioTimeline(ctx, projectID, episodeID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	record, err := s.ensureAudioRuntime(ctx, projectID, episodeID, timeline.ID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	return AudioRuntimeState{Runtime: record}, nil
}

func (s *Service) RequestAudioRender(ctx context.Context, input RequestAudioRenderInput) (AudioRuntimeState, error) {
	if s == nil || s.repo == nil {
		return AudioRuntimeState{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	timeline, err := s.ensureAudioTimeline(ctx, projectID, episodeID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	if !s.audioTimelineHasRenderableContent(timeline.ID) {
		return AudioRuntimeState{}, errors.New("projectapp: failed precondition: audio timeline is empty")
	}

	record, err := s.ensureAudioRuntime(ctx, projectID, episodeID, timeline.ID)
	if err != nil {
		return AudioRuntimeState{}, err
	}
	if audioRenderInFlight(record.RenderStatus) {
		return AudioRuntimeState{}, errors.New("projectapp: failed precondition: audio render already queued")
	}

	projectRecord, ok := s.repo.GetProject(projectID)
	if !ok {
		return AudioRuntimeState{}, errors.New("projectapp: project not found after audio scope validation")
	}
	if s.startWorkflow == nil {
		return AudioRuntimeState{}, errors.New("projectapp: workflow starter is required")
	}
	run, err := s.startWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID: projectRecord.OrganizationID,
		ProjectID:      projectID,
		WorkflowType:   "audio.render_mix",
		ResourceID:     record.ID,
	})
	if err != nil {
		return AudioRuntimeState{}, err
	}

	now := time.Now().UTC()
	record.AudioTimelineID = timeline.ID
	record.Status = audioRuntimeStatusQueued
	record.RenderWorkflowRunID = run.ID
	record.RenderStatus = audioRenderStatusQueued
	record.MixAssetID = ""
	record.MixOutput = project.AudioMixDelivery{}
	record.Waveforms = nil
	record.LastErrorCode = ""
	record.LastErrorMessage = ""
	record.UpdatedAt = now
	if err := s.repo.SaveAudioRuntime(ctx, record); err != nil {
		return AudioRuntimeState{}, err
	}

	events.PublishAudioRuntimeUpdated(ctx, s.repo.Publisher(), events.PublishAudioRuntimeUpdatedInput{
		OrganizationID:      projectRecord.OrganizationID,
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		AudioRuntimeID:      record.ID,
		RenderStatus:        record.RenderStatus,
		RenderWorkflowRunID: record.RenderWorkflowRunID,
		MixAssetID:          record.MixAssetID,
		OccurredAt:          now,
	})

	return AudioRuntimeState{Runtime: record}, nil
}

func (s *Service) ApplyAudioRenderUpdate(ctx context.Context, input ApplyAudioRenderUpdateInput) (AudioRuntimeState, error) {
	if s == nil || s.repo == nil {
		return AudioRuntimeState{}, errors.New("projectapp: repository is required")
	}
	audioRuntimeID := strings.TrimSpace(input.AudioRuntimeID)
	if audioRuntimeID == "" {
		return AudioRuntimeState{}, errors.New("projectapp: audio_runtime_id is required")
	}
	renderWorkflowRunID := strings.TrimSpace(input.RenderWorkflowRunID)
	if renderWorkflowRunID == "" {
		return AudioRuntimeState{}, errors.New("projectapp: render_workflow_run_id is required")
	}
	renderStatus := strings.TrimSpace(input.RenderStatus)
	if !isValidAudioRenderUpdateStatus(renderStatus) {
		return AudioRuntimeState{}, errors.New("projectapp: invalid argument: render_status must be running, completed, or failed")
	}
	record, ok := s.repo.GetAudioRuntimeByID(audioRuntimeID)
	if !ok {
		return AudioRuntimeState{}, errors.New("projectapp: audio runtime not found")
	}
	if strings.TrimSpace(record.RenderWorkflowRunID) != renderWorkflowRunID {
		return AudioRuntimeState{}, errors.New("projectapp: failed precondition: audio runtime workflow run mismatch")
	}
	if err := validateAudioRenderUpdate(input); err != nil {
		return AudioRuntimeState{}, err
	}

	workflowRun, ok := s.repo.GetWorkflowRun(renderWorkflowRunID)
	if !ok {
		return AudioRuntimeState{}, errors.New("projectapp: failed precondition: render workflow run not found")
	}
	if strings.TrimSpace(workflowRun.ResourceID) != audioRuntimeID {
		return AudioRuntimeState{}, errors.New("projectapp: failed precondition: render workflow run scope mismatch")
	}

	now := time.Now().UTC()
	record.UpdatedAt = now
	switch renderStatus {
	case audioRenderStatusRunning:
		record.Status = audioRuntimeStatusRunning
		record.RenderStatus = audioRenderStatusRunning
		record.LastErrorCode = ""
		record.LastErrorMessage = ""
		workflowRun.Status = workflow.StatusRunning
		workflowRun.LastError = ""
	case audioRenderStatusCompleted:
		record.Status = audioRuntimeStatusReady
		record.RenderStatus = audioRenderStatusCompleted
		record.MixAssetID = strings.TrimSpace(input.MixAssetID)
		record.MixOutput = normalizeAudioMixDelivery(input.MixOutput)
		record.Waveforms = normalizeAudioWaveformReferences(input.Waveforms)
		record.LastErrorCode = ""
		record.LastErrorMessage = ""
		workflowRun.Status = workflow.StatusCompleted
		workflowRun.LastError = ""
	case audioRenderStatusFailed:
		record.Status = audioRuntimeStatusFailed
		record.RenderStatus = audioRenderStatusFailed
		record.LastErrorCode = strings.TrimSpace(input.ErrorCode)
		record.LastErrorMessage = strings.TrimSpace(input.ErrorMessage)
		workflowRun.Status = workflow.StatusFailed
		workflowRun.LastError = strings.TrimSpace(input.ErrorMessage)
		if workflowRun.LastError == "" {
			workflowRun.LastError = strings.TrimSpace(input.ErrorCode)
		}
	}

	workflowRun.UpdatedAt = now
	if err := s.repo.SaveAudioRuntime(ctx, record); err != nil {
		return AudioRuntimeState{}, err
	}
	if err := s.repo.SaveWorkflowRun(ctx, workflowRun); err != nil {
		return AudioRuntimeState{}, err
	}

	projectRecord, ok := s.repo.GetProject(record.ProjectID)
	if !ok {
		return AudioRuntimeState{}, errors.New("projectapp: project not found after audio runtime update")
	}
	events.PublishAudioRuntimeUpdated(ctx, s.repo.Publisher(), events.PublishAudioRuntimeUpdatedInput{
		OrganizationID:      projectRecord.OrganizationID,
		ProjectID:           record.ProjectID,
		EpisodeID:           record.EpisodeID,
		AudioRuntimeID:      record.ID,
		RenderStatus:        record.RenderStatus,
		RenderWorkflowRunID: record.RenderWorkflowRunID,
		MixAssetID:          record.MixAssetID,
		OccurredAt:          now,
	})

	return AudioRuntimeState{Runtime: record}, nil
}

func (s *Service) ensureAudioRuntime(ctx context.Context, projectID string, episodeID string, audioTimelineID string) (project.AudioRuntime, error) {
	if record, ok := s.repo.GetAudioRuntime(projectID, episodeID); ok {
		if strings.TrimSpace(record.AudioTimelineID) == "" && strings.TrimSpace(audioTimelineID) != "" {
			record.AudioTimelineID = strings.TrimSpace(audioTimelineID)
			record.UpdatedAt = time.Now().UTC()
			if err := s.repo.SaveAudioRuntime(ctx, record); err != nil {
				return project.AudioRuntime{}, err
			}
		}
		return record, nil
	}

	now := time.Now().UTC()
	record := project.AudioRuntime{
		ID:              s.repo.GenerateAudioRuntimeID(),
		ProjectID:       projectID,
		EpisodeID:       episodeID,
		AudioTimelineID: strings.TrimSpace(audioTimelineID),
		Status:          audioRuntimeStatusDraft,
		RenderStatus:    audioRenderStatusIdle,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.repo.SaveAudioRuntime(ctx, record); err != nil {
		if db.IsUniqueViolation(err) {
			if existing, ok := s.repo.GetAudioRuntime(projectID, episodeID); ok {
				return existing, nil
			}
		}
		return project.AudioRuntime{}, err
	}
	return record, nil
}

func (s *Service) audioTimelineHasRenderableContent(timelineID string) bool {
	tracks := s.repo.ListAudioTracks(strings.TrimSpace(timelineID))
	for _, track := range tracks {
		if len(s.repo.ListAudioClips(track.ID)) > 0 {
			return true
		}
	}
	return false
}

func audioRenderInFlight(renderStatus string) bool {
	switch strings.TrimSpace(renderStatus) {
	case audioRenderStatusQueued, audioRenderStatusRunning:
		return true
	default:
		return false
	}
}

func isValidAudioRenderUpdateStatus(renderStatus string) bool {
	switch strings.TrimSpace(renderStatus) {
	case audioRenderStatusRunning, audioRenderStatusCompleted, audioRenderStatusFailed:
		return true
	default:
		return false
	}
}

func validateAudioRenderUpdate(input ApplyAudioRenderUpdateInput) error {
	switch strings.TrimSpace(input.RenderStatus) {
	case audioRenderStatusCompleted:
		if !hasAudioMixDelivery(input.MixOutput) {
			return errors.New("projectapp: failed precondition: completed audio render requires mix_output")
		}
		if strings.TrimSpace(input.MixAssetID) == "" {
			return errors.New("projectapp: failed precondition: mix_asset_id is required when mix_output is present")
		}
		if err := validateAudioWaveformReferences(input.Waveforms); err != nil {
			return err
		}
	case audioRenderStatusFailed:
		if strings.TrimSpace(input.ErrorCode) == "" && strings.TrimSpace(input.ErrorMessage) == "" {
			return errors.New("projectapp: failed precondition: failed audio render requires error_code or error_message")
		}
	default:
		if err := validateAudioWaveformReferences(input.Waveforms); err != nil {
			return err
		}
	}
	return nil
}

func hasAudioMixDelivery(delivery project.AudioMixDelivery) bool {
	return strings.TrimSpace(delivery.DeliveryMode) != "" ||
		strings.TrimSpace(delivery.PlaybackURL) != "" ||
		strings.TrimSpace(delivery.DownloadURL) != "" ||
		strings.TrimSpace(delivery.MimeType) != "" ||
		strings.TrimSpace(delivery.FileName) != "" ||
		delivery.SizeBytes > 0 ||
		delivery.DurationMs > 0
}

func normalizeAudioMixDelivery(delivery project.AudioMixDelivery) project.AudioMixDelivery {
	return project.AudioMixDelivery{
		DeliveryMode: strings.TrimSpace(delivery.DeliveryMode),
		PlaybackURL:  strings.TrimSpace(delivery.PlaybackURL),
		DownloadURL:  strings.TrimSpace(delivery.DownloadURL),
		MimeType:     strings.TrimSpace(delivery.MimeType),
		FileName:     strings.TrimSpace(delivery.FileName),
		SizeBytes:    delivery.SizeBytes,
		DurationMs:   delivery.DurationMs,
	}
}

func validateAudioWaveformReferences(waveforms []project.AudioWaveformReference) error {
	for _, waveform := range waveforms {
		if strings.TrimSpace(waveform.AssetID) == "" {
			return errors.New("projectapp: invalid argument: waveform.asset_id is required")
		}
		if strings.TrimSpace(waveform.VariantID) == "" {
			return errors.New("projectapp: invalid argument: waveform.variant_id is required")
		}
		if strings.TrimSpace(waveform.WaveformURL) == "" {
			return errors.New("projectapp: invalid argument: waveform.waveform_url is required")
		}
	}
	return nil
}

func normalizeAudioWaveformReferences(waveforms []project.AudioWaveformReference) []project.AudioWaveformReference {
	if len(waveforms) == 0 {
		return nil
	}
	normalized := make([]project.AudioWaveformReference, 0, len(waveforms))
	for _, waveform := range waveforms {
		normalized = append(normalized, project.AudioWaveformReference{
			AssetID:     strings.TrimSpace(waveform.AssetID),
			VariantID:   strings.TrimSpace(waveform.VariantID),
			WaveformURL: strings.TrimSpace(waveform.WaveformURL),
			MimeType:    strings.TrimSpace(waveform.MimeType),
			DurationMs:  waveform.DurationMs,
		})
	}
	return normalized
}
