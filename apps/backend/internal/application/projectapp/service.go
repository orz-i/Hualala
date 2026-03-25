package projectapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	repo          repository
	startWorkflow func(context.Context, workflowapp.StartWorkflowInput) (workflow.WorkflowRun, error)
}

type repository interface {
	db.ProjectContentRepository
	db.ExecutionRepository
	db.AssetRepository
	db.WorkflowRepository
	db.PolicyReader
	Publisher() *events.Publisher
}

type CreateProjectInput struct {
	OrganizationID          string
	OwnerUserID             string
	Title                   string
	Status                  string
	CurrentStage            string
	PrimaryContentLocale    string
	SupportedContentLocales []string
}

type CreateEpisodeInput struct {
	ProjectID string
	EpisodeNo int
	Title     string
}

type GetProjectInput struct {
	ProjectID string
}

type ListProjectsInput struct {
	OrganizationID string
}

type ListEpisodesInput struct {
	ProjectID string
}

type PreviewWorkbench struct {
	Assembly project.PreviewAssembly
	Items    []PreviewAssemblyItemState
}

type PreviewRuntimeState struct {
	Runtime project.PreviewRuntime
}

type AudioRuntimeState struct {
	Runtime project.AudioRuntime
}

type GetPreviewWorkbenchInput struct {
	ProjectID     string
	EpisodeID     string
	DisplayLocale string
}

type GetPreviewRuntimeInput struct {
	ProjectID string
	EpisodeID string
}

type RequestPreviewRenderInput struct {
	ProjectID       string
	EpisodeID       string
	RequestedLocale string
}

type ApplyPreviewRenderUpdateInput struct {
	PreviewRuntimeID    string
	RenderWorkflowRunID string
	RenderStatus        string
	ResolvedLocale      string
	PlaybackAssetID     string
	ExportAssetID       string
	Playback            project.PreviewPlaybackDelivery
	ExportOutput        project.PreviewExportDelivery
	ErrorCode           string
	ErrorMessage        string
}

type GetAudioRuntimeInput struct {
	ProjectID string
	EpisodeID string
}

type RequestAudioRenderInput struct {
	ProjectID string
	EpisodeID string
}

type ApplyAudioRenderUpdateInput struct {
	AudioRuntimeID      string
	RenderWorkflowRunID string
	RenderStatus        string
	MixAssetID          string
	MixOutput           project.AudioMixDelivery
	Waveforms           []project.AudioWaveformReference
	ErrorCode           string
	ErrorMessage        string
}

type PreviewAssemblyItemInput struct {
	ShotID         string
	PrimaryAssetID string
	SourceRunID    string
	Sequence       int
}

type UpsertPreviewAssemblyInput struct {
	ProjectID string
	EpisodeID string
	Status    string
	Items     []PreviewAssemblyItemInput
}

type PreviewShotSummary struct {
	ProjectID    string
	ProjectTitle string
	EpisodeID    string
	EpisodeTitle string
	SceneID      string
	SceneCode    string
	SceneTitle   string
	ShotID       string
	ShotCode     string
	ShotTitle    string
}

type PreviewAssetSummary struct {
	AssetID      string
	MediaType    string
	RightsStatus string
	AIAnnotated  bool
}

type PreviewRunSummary struct {
	RunID       string
	Status      string
	TriggerType string
}

type PreviewAssemblyItemState struct {
	ID             string
	AssemblyID     string
	ShotID         string
	PrimaryAssetID string
	SourceRunID    string
	Sequence       int
	CreatedAt      time.Time
	UpdatedAt      time.Time
	Shot           PreviewShotSummary
	PrimaryAsset   *PreviewAssetSummary
	SourceRun      *PreviewRunSummary
}

type ListPreviewShotOptionsInput struct {
	ProjectID     string
	EpisodeID     string
	DisplayLocale string
}

const previewNoDisplayLocale = ""

type PreviewShotOption struct {
	Shot                PreviewShotSummary
	ShotExecutionID     string
	ShotExecutionStatus string
	CurrentPrimaryAsset *PreviewAssetSummary
	LatestRun           *PreviewRunSummary
}

func NewService(repo repository) *Service {
	return &Service{
		repo: repo,
		startWorkflow: func(ctx context.Context, input workflowapp.StartWorkflowInput) (workflow.WorkflowRun, error) {
			service := workflowapp.NewService(repo, repo.Publisher(), nil, policyapp.NewService(repo))
			return service.StartWorkflow(ctx, input)
		},
	}
}

func (s *Service) CreateProject(ctx context.Context, input CreateProjectInput) (project.Project, error) {
	if s == nil || s.repo == nil {
		return project.Project{}, errors.New("projectapp: repository is required")
	}
	if strings.TrimSpace(input.OrganizationID) == "" {
		return project.Project{}, errors.New("projectapp: organization_id is required")
	}
	if strings.TrimSpace(input.OwnerUserID) == "" {
		return project.Project{}, errors.New("projectapp: owner_user_id is required")
	}
	if strings.TrimSpace(input.Title) == "" {
		return project.Project{}, errors.New("projectapp: title is required")
	}

	now := time.Now().UTC()
	primaryContentLocale := strings.TrimSpace(input.PrimaryContentLocale)
	if primaryContentLocale == "" {
		primaryContentLocale = "zh-CN"
	}
	supportedContentLocales := append([]string(nil), input.SupportedContentLocales...)
	if len(supportedContentLocales) == 0 {
		supportedContentLocales = []string{primaryContentLocale}
	}
	record := project.Project{
		ID:                      s.repo.GenerateProjectID(),
		OrganizationID:          strings.TrimSpace(input.OrganizationID),
		OwnerUserID:             strings.TrimSpace(input.OwnerUserID),
		Title:                   strings.TrimSpace(input.Title),
		Status:                  strings.TrimSpace(input.Status),
		CurrentStage:            strings.TrimSpace(input.CurrentStage),
		PrimaryContentLocale:    primaryContentLocale,
		SupportedContentLocales: supportedContentLocales,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	if record.Status == "" {
		record.Status = "draft"
	}
	if record.CurrentStage == "" {
		record.CurrentStage = "planning"
	}

	if err := s.repo.SaveProject(ctx, record); err != nil {
		return project.Project{}, err
	}
	return record, nil
}

func (s *Service) CreateEpisode(ctx context.Context, input CreateEpisodeInput) (project.Episode, error) {
	if s == nil || s.repo == nil {
		return project.Episode{}, errors.New("projectapp: repository is required")
	}
	if strings.TrimSpace(input.ProjectID) == "" {
		return project.Episode{}, errors.New("projectapp: project_id is required")
	}
	if input.EpisodeNo <= 0 {
		return project.Episode{}, errors.New("projectapp: episode_no must be greater than 0")
	}
	if strings.TrimSpace(input.Title) == "" {
		return project.Episode{}, errors.New("projectapp: title is required")
	}
	if _, ok := s.repo.GetProject(strings.TrimSpace(input.ProjectID)); !ok {
		return project.Episode{}, errors.New("projectapp: project not found")
	}

	now := time.Now().UTC()
	record := project.Episode{
		ID:        s.repo.GenerateEpisodeID(),
		ProjectID: strings.TrimSpace(input.ProjectID),
		EpisodeNo: input.EpisodeNo,
		Title:     strings.TrimSpace(input.Title),
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.SaveEpisode(ctx, record); err != nil {
		return project.Episode{}, err
	}
	return record, nil
}

func (s *Service) GetProject(_ context.Context, input GetProjectInput) (project.Project, error) {
	if s == nil || s.repo == nil {
		return project.Project{}, errors.New("projectapp: repository is required")
	}
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return project.Project{}, errors.New("projectapp: project_id is required")
	}
	record, ok := s.repo.GetProject(projectID)
	if !ok {
		return project.Project{}, errors.New("projectapp: project not found")
	}
	return record, nil
}

func (s *Service) ListProjects(_ context.Context, input ListProjectsInput) ([]project.Project, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projectapp: repository is required")
	}
	organizationID := strings.TrimSpace(input.OrganizationID)
	if organizationID == "" {
		return nil, errors.New("projectapp: org_id is required")
	}

	return s.repo.ListProjectsByOrganization(organizationID), nil
}

func (s *Service) ListEpisodes(_ context.Context, input ListEpisodesInput) ([]project.Episode, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projectapp: repository is required")
	}
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return nil, errors.New("projectapp: project_id is required")
	}
	return s.repo.ListEpisodesByProject(projectID), nil
}

func (s *Service) GetPreviewWorkbench(ctx context.Context, input GetPreviewWorkbenchInput) (PreviewWorkbench, error) {
	if s == nil || s.repo == nil {
		return PreviewWorkbench{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return PreviewWorkbench{}, err
	}
	record, err := s.ensurePreviewAssembly(ctx, projectID, episodeID)
	if err != nil {
		return PreviewWorkbench{}, err
	}
	return s.buildPreviewWorkbench(record, input.DisplayLocale), nil
}

func (s *Service) UpsertPreviewAssembly(ctx context.Context, input UpsertPreviewAssemblyInput) (PreviewWorkbench, error) {
	if s == nil || s.repo == nil {
		return PreviewWorkbench{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return PreviewWorkbench{}, err
	}
	record, err := s.ensurePreviewAssembly(ctx, projectID, episodeID)
	if err != nil {
		return PreviewWorkbench{}, err
	}
	now := time.Now().UTC()
	record.Status = defaultPreviewStatus(input.Status)
	record.UpdatedAt = now
	if err := s.repo.SavePreviewAssembly(ctx, record); err != nil {
		return PreviewWorkbench{}, err
	}

	items := make([]project.PreviewAssemblyItem, 0, len(input.Items))
	for index, item := range input.Items {
		shotID := strings.TrimSpace(item.ShotID)
		if shotID == "" {
			return PreviewWorkbench{}, errors.New("projectapp: shot_id is required")
		}
		shot, ok := s.repo.GetShot(shotID)
		if !ok {
			return PreviewWorkbench{}, fmt.Errorf("projectapp: shot %q not found", shotID)
		}
		scene, ok := s.repo.GetScene(shot.SceneID)
		if !ok {
			return PreviewWorkbench{}, fmt.Errorf("projectapp: scene %q not found", shot.SceneID)
		}
		if scene.ProjectID != projectID {
			return PreviewWorkbench{}, errors.New("projectapp: failed precondition: shot scope does not match project")
		}
		if episodeID != "" && scene.EpisodeID != episodeID {
			return PreviewWorkbench{}, errors.New("projectapp: failed precondition: shot scope does not match episode")
		}

		sequence := item.Sequence
		if sequence <= 0 {
			sequence = index + 1
		}
		items = append(items, project.PreviewAssemblyItem{
			ID:             s.repo.GeneratePreviewAssemblyItemID(),
			AssemblyID:     record.ID,
			ShotID:         shotID,
			PrimaryAssetID: strings.TrimSpace(item.PrimaryAssetID),
			SourceRunID:    strings.TrimSpace(item.SourceRunID),
			Sequence:       sequence,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}
	if err := s.repo.ReplacePreviewAssemblyItems(ctx, record.ID, items); err != nil {
		return PreviewWorkbench{}, err
	}
	return s.buildPreviewWorkbench(record, previewNoDisplayLocale), nil
}

func (s *Service) normalizePreviewScope(projectID string, episodeID string) (string, string, error) {
	normalizedProjectID := strings.TrimSpace(projectID)
	if normalizedProjectID == "" {
		return "", "", errors.New("projectapp: project_id is required")
	}
	if _, ok := s.repo.GetProject(normalizedProjectID); !ok {
		return "", "", errors.New("projectapp: project not found")
	}
	normalizedEpisodeID := strings.TrimSpace(episodeID)
	if normalizedEpisodeID != "" {
		record, ok := s.repo.GetEpisode(normalizedEpisodeID)
		if !ok {
			return "", "", errors.New("projectapp: episode not found")
		}
		if record.ProjectID != normalizedProjectID {
			return "", "", errors.New("projectapp: failed precondition: episode scope does not match project")
		}
	}
	return normalizedProjectID, normalizedEpisodeID, nil
}

func (s *Service) ensurePreviewAssembly(ctx context.Context, projectID string, episodeID string) (project.PreviewAssembly, error) {
	if record, ok := s.repo.GetPreviewAssembly(projectID, episodeID); ok {
		return record, nil
	}
	now := time.Now().UTC()
	record := project.PreviewAssembly{
		ID:        s.repo.GeneratePreviewAssemblyID(),
		ProjectID: projectID,
		EpisodeID: episodeID,
		Status:    "draft",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.SavePreviewAssembly(ctx, record); err != nil {
		return project.PreviewAssembly{}, err
	}
	return record, nil
}

func defaultPreviewStatus(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "draft"
	}
	return trimmed
}
