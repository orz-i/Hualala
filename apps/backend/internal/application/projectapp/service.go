package projectapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	repo db.ProjectContentRepository
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

func NewService(repo db.ProjectContentRepository) *Service {
	return &Service{repo: repo}
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
