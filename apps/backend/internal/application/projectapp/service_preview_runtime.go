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
	previewRuntimeStatusDraft    = "draft"
	previewRuntimeStatusQueued   = "queued"
	previewRuntimeStatusRunning  = "running"
	previewRuntimeStatusReady    = "ready"
	previewRuntimeStatusFailed   = "failed"
	previewRenderStatusIdle      = "idle"
	previewRenderStatusQueued    = "queued"
	previewRenderStatusRunning   = "running"
	previewRenderStatusCompleted = "completed"
	previewRenderStatusFailed    = "failed"
)

func (s *Service) GetPreviewRuntime(ctx context.Context, input GetPreviewRuntimeInput) (PreviewRuntimeState, error) {
	if s == nil || s.repo == nil {
		return PreviewRuntimeState{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	assembly, err := s.ensurePreviewAssembly(ctx, projectID, episodeID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	record, err := s.ensurePreviewRuntime(ctx, projectID, episodeID, assembly.ID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	return PreviewRuntimeState{Runtime: record}, nil
}

func (s *Service) RequestPreviewRender(ctx context.Context, input RequestPreviewRenderInput) (PreviewRuntimeState, error) {
	if s == nil || s.repo == nil {
		return PreviewRuntimeState{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	assembly, err := s.ensurePreviewAssembly(ctx, projectID, episodeID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	if len(s.repo.ListPreviewAssemblyItems(assembly.ID)) == 0 {
		return PreviewRuntimeState{}, errors.New("projectapp: failed precondition: preview assembly is empty")
	}

	record, err := s.ensurePreviewRuntime(ctx, projectID, episodeID, assembly.ID)
	if err != nil {
		return PreviewRuntimeState{}, err
	}
	if previewRenderInFlight(record.RenderStatus) {
		return PreviewRuntimeState{}, errors.New("projectapp: failed precondition: preview render already queued")
	}

	projectRecord, ok := s.repo.GetProject(projectID)
	if !ok {
		return PreviewRuntimeState{}, errors.New("projectapp: project not found after preview scope validation")
	}
	if s.startWorkflow == nil {
		return PreviewRuntimeState{}, errors.New("projectapp: workflow starter is required")
	}
	run, err := s.startWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID: projectRecord.OrganizationID,
		ProjectID:      projectID,
		WorkflowType:   "preview.render_assembly",
		ResourceID:     record.ID,
	})
	if err != nil {
		return PreviewRuntimeState{}, err
	}

	now := time.Now().UTC()
	record.AssemblyID = assembly.ID
	record.Status = previewRuntimeStatusQueued
	record.RenderWorkflowRunID = run.ID
	record.RenderStatus = previewRenderStatusQueued
	record.ResolvedLocale = strings.TrimSpace(input.RequestedLocale)
	record.PlaybackAssetID = ""
	record.ExportAssetID = ""
	record.Playback = project.PreviewPlaybackDelivery{}
	record.ExportOutput = project.PreviewExportDelivery{}
	record.LastErrorCode = ""
	record.LastErrorMessage = ""
	record.UpdatedAt = now
	if err := s.repo.SavePreviewRuntime(ctx, record); err != nil {
		return PreviewRuntimeState{}, err
	}

	events.PublishPreviewRuntimeUpdated(ctx, s.repo.Publisher(), events.PublishPreviewRuntimeUpdatedInput{
		OrganizationID:      projectRecord.OrganizationID,
		ProjectID:           projectID,
		EpisodeID:           episodeID,
		PreviewRuntimeID:    record.ID,
		RenderStatus:        record.RenderStatus,
		RenderWorkflowRunID: record.RenderWorkflowRunID,
		ResolvedLocale:      record.ResolvedLocale,
		PlaybackAssetID:     record.PlaybackAssetID,
		ExportAssetID:       record.ExportAssetID,
		OccurredAt:          now,
	})

	return PreviewRuntimeState{Runtime: record}, nil
}

func (s *Service) ApplyPreviewRenderUpdate(ctx context.Context, input ApplyPreviewRenderUpdateInput) (PreviewRuntimeState, error) {
	if s == nil || s.repo == nil {
		return PreviewRuntimeState{}, errors.New("projectapp: repository is required")
	}
	previewRuntimeID := strings.TrimSpace(input.PreviewRuntimeID)
	if previewRuntimeID == "" {
		return PreviewRuntimeState{}, errors.New("projectapp: preview_runtime_id is required")
	}
	renderWorkflowRunID := strings.TrimSpace(input.RenderWorkflowRunID)
	if renderWorkflowRunID == "" {
		return PreviewRuntimeState{}, errors.New("projectapp: render_workflow_run_id is required")
	}
	renderStatus := strings.TrimSpace(input.RenderStatus)
	if !isValidPreviewRenderUpdateStatus(renderStatus) {
		return PreviewRuntimeState{}, errors.New("projectapp: invalid argument: render_status must be running, completed, or failed")
	}
	record, ok := s.repo.GetPreviewRuntimeByID(previewRuntimeID)
	if !ok {
		return PreviewRuntimeState{}, errors.New("projectapp: preview runtime not found")
	}
	if strings.TrimSpace(record.RenderWorkflowRunID) != renderWorkflowRunID {
		return PreviewRuntimeState{}, errors.New("projectapp: failed precondition: preview runtime workflow run mismatch")
	}
	if err := validatePreviewRenderUpdate(input); err != nil {
		return PreviewRuntimeState{}, err
	}

	workflowRun, ok := s.repo.GetWorkflowRun(renderWorkflowRunID)
	if !ok {
		return PreviewRuntimeState{}, errors.New("projectapp: failed precondition: render workflow run not found")
	}
	if strings.TrimSpace(workflowRun.ResourceID) != previewRuntimeID {
		return PreviewRuntimeState{}, errors.New("projectapp: failed precondition: render workflow run scope mismatch")
	}

	now := time.Now().UTC()
	record.UpdatedAt = now
	if locale := strings.TrimSpace(input.ResolvedLocale); locale != "" {
		record.ResolvedLocale = locale
	}

	switch renderStatus {
	case previewRenderStatusRunning:
		record.Status = previewRuntimeStatusRunning
		record.RenderStatus = previewRenderStatusRunning
		record.LastErrorCode = ""
		record.LastErrorMessage = ""
		workflowRun.Status = workflow.StatusRunning
		workflowRun.LastError = ""
	case previewRenderStatusCompleted:
		record.Status = previewRuntimeStatusReady
		record.RenderStatus = previewRenderStatusCompleted
		record.PlaybackAssetID = strings.TrimSpace(input.PlaybackAssetID)
		record.ExportAssetID = strings.TrimSpace(input.ExportAssetID)
		record.Playback = normalizePreviewPlaybackDelivery(input.Playback)
		record.ExportOutput = normalizePreviewExportDelivery(input.ExportOutput)
		record.LastErrorCode = ""
		record.LastErrorMessage = ""
		workflowRun.Status = workflow.StatusCompleted
		workflowRun.LastError = ""
	case previewRenderStatusFailed:
		record.Status = previewRuntimeStatusFailed
		record.RenderStatus = previewRenderStatusFailed
		record.LastErrorCode = strings.TrimSpace(input.ErrorCode)
		record.LastErrorMessage = strings.TrimSpace(input.ErrorMessage)
		workflowRun.Status = workflow.StatusFailed
		workflowRun.LastError = strings.TrimSpace(input.ErrorMessage)
		if workflowRun.LastError == "" {
			workflowRun.LastError = strings.TrimSpace(input.ErrorCode)
		}
	}

	workflowRun.UpdatedAt = now
	if err := s.repo.SavePreviewRuntime(ctx, record); err != nil {
		return PreviewRuntimeState{}, err
	}
	if err := s.repo.SaveWorkflowRun(ctx, workflowRun); err != nil {
		return PreviewRuntimeState{}, err
	}

	projectRecord, ok := s.repo.GetProject(record.ProjectID)
	if !ok {
		return PreviewRuntimeState{}, errors.New("projectapp: project not found after preview runtime update")
	}
	events.PublishPreviewRuntimeUpdated(ctx, s.repo.Publisher(), events.PublishPreviewRuntimeUpdatedInput{
		OrganizationID:      projectRecord.OrganizationID,
		ProjectID:           record.ProjectID,
		EpisodeID:           record.EpisodeID,
		PreviewRuntimeID:    record.ID,
		RenderStatus:        record.RenderStatus,
		RenderWorkflowRunID: record.RenderWorkflowRunID,
		ResolvedLocale:      record.ResolvedLocale,
		PlaybackAssetID:     record.PlaybackAssetID,
		ExportAssetID:       record.ExportAssetID,
		OccurredAt:          now,
	})

	return PreviewRuntimeState{Runtime: record}, nil
}

func (s *Service) ensurePreviewRuntime(ctx context.Context, projectID string, episodeID string, assemblyID string) (project.PreviewRuntime, error) {
	if record, ok := s.repo.GetPreviewRuntime(projectID, episodeID); ok {
		if strings.TrimSpace(record.AssemblyID) == "" && strings.TrimSpace(assemblyID) != "" {
			record.AssemblyID = strings.TrimSpace(assemblyID)
			record.UpdatedAt = time.Now().UTC()
			if err := s.repo.SavePreviewRuntime(ctx, record); err != nil {
				return project.PreviewRuntime{}, err
			}
		}
		return record, nil
	}

	now := time.Now().UTC()
	record := project.PreviewRuntime{
		ID:           s.repo.GeneratePreviewRuntimeID(),
		ProjectID:    projectID,
		EpisodeID:    episodeID,
		AssemblyID:   strings.TrimSpace(assemblyID),
		Status:       previewRuntimeStatusDraft,
		RenderStatus: previewRenderStatusIdle,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.SavePreviewRuntime(ctx, record); err != nil {
		if db.IsUniqueViolation(err) {
			if existing, ok := s.repo.GetPreviewRuntime(projectID, episodeID); ok {
				return existing, nil
			}
		}
		return project.PreviewRuntime{}, err
	}
	return record, nil
}

func previewRenderInFlight(renderStatus string) bool {
	switch strings.TrimSpace(renderStatus) {
	case "queued", "running":
		return true
	default:
		return false
	}
}

func isValidPreviewRenderUpdateStatus(renderStatus string) bool {
	switch strings.TrimSpace(renderStatus) {
	case previewRenderStatusRunning, previewRenderStatusCompleted, previewRenderStatusFailed:
		return true
	default:
		return false
	}
}

func validatePreviewRenderUpdate(input ApplyPreviewRenderUpdateInput) error {
	switch strings.TrimSpace(input.RenderStatus) {
	case previewRenderStatusCompleted:
		hasPlayback := hasPreviewPlaybackDelivery(input.Playback)
		hasExport := hasPreviewExportDelivery(input.ExportOutput)
		if !hasPlayback && !hasExport {
			return errors.New("projectapp: failed precondition: completed preview render requires playback or export output")
		}
		if hasPlayback && strings.TrimSpace(input.PlaybackAssetID) == "" {
			return errors.New("projectapp: failed precondition: playback_asset_id is required when playback delivery is present")
		}
		if hasExport && strings.TrimSpace(input.ExportAssetID) == "" {
			return errors.New("projectapp: failed precondition: export_asset_id is required when export output is present")
		}
		if hasPlayback && !isValidPreviewPlaybackDeliveryMode(input.Playback.DeliveryMode) {
			return errors.New("projectapp: invalid argument: playback.delivery_mode must be file or manifest")
		}
	case previewRenderStatusFailed:
		if strings.TrimSpace(input.ErrorCode) == "" && strings.TrimSpace(input.ErrorMessage) == "" {
			return errors.New("projectapp: failed precondition: failed preview render requires error_code or error_message")
		}
	}
	return nil
}

func hasPreviewPlaybackDelivery(delivery project.PreviewPlaybackDelivery) bool {
	return strings.TrimSpace(delivery.DeliveryMode) != "" ||
		strings.TrimSpace(delivery.PlaybackURL) != "" ||
		strings.TrimSpace(delivery.PosterURL) != "" ||
		delivery.DurationMs > 0
}

func hasPreviewExportDelivery(delivery project.PreviewExportDelivery) bool {
	return strings.TrimSpace(delivery.DownloadURL) != "" ||
		strings.TrimSpace(delivery.MimeType) != "" ||
		strings.TrimSpace(delivery.FileName) != "" ||
		delivery.SizeBytes > 0
}

func normalizePreviewPlaybackDelivery(delivery project.PreviewPlaybackDelivery) project.PreviewPlaybackDelivery {
	return project.PreviewPlaybackDelivery{
		DeliveryMode: strings.TrimSpace(delivery.DeliveryMode),
		PlaybackURL:  strings.TrimSpace(delivery.PlaybackURL),
		PosterURL:    strings.TrimSpace(delivery.PosterURL),
		DurationMs:   delivery.DurationMs,
	}
}

func normalizePreviewExportDelivery(delivery project.PreviewExportDelivery) project.PreviewExportDelivery {
	return project.PreviewExportDelivery{
		DownloadURL: strings.TrimSpace(delivery.DownloadURL),
		MimeType:    strings.TrimSpace(delivery.MimeType),
		FileName:    strings.TrimSpace(delivery.FileName),
		SizeBytes:   delivery.SizeBytes,
	}
}

func isValidPreviewPlaybackDeliveryMode(deliveryMode string) bool {
	switch strings.TrimSpace(deliveryMode) {
	case "file", "manifest":
		return true
	default:
		return false
	}
}
