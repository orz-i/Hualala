package projectapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

const (
	previewRuntimeStatusDraft  = "draft"
	previewRuntimeStatusQueued = "queued"
	previewRenderStatusIdle    = "idle"
	previewRenderStatusQueued  = "queued"
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

	projectRecord, _ := s.repo.GetProject(projectID)
	workflowService := workflowapp.NewService(s.repo, s.repo.Publisher(), nil, policyapp.NewService(s.repo))
	run, err := workflowService.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
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
