package projectapp

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
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

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) CreateProject(_ context.Context, input CreateProjectInput) (project.Project, error) {
	if s == nil || s.store == nil {
		return project.Project{}, errors.New("projectapp: store is required")
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
		ID:                      s.store.NextProjectID(),
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

	s.store.Projects[record.ID] = record
	return record, nil
}

func (s *Service) CreateEpisode(_ context.Context, input CreateEpisodeInput) (project.Episode, error) {
	if s == nil || s.store == nil {
		return project.Episode{}, errors.New("projectapp: store is required")
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
	if _, ok := s.store.Projects[strings.TrimSpace(input.ProjectID)]; !ok {
		return project.Episode{}, errors.New("projectapp: project not found")
	}

	now := time.Now().UTC()
	record := project.Episode{
		ID:        s.store.NextEpisodeID(),
		ProjectID: strings.TrimSpace(input.ProjectID),
		EpisodeNo: input.EpisodeNo,
		Title:     strings.TrimSpace(input.Title),
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.store.Episodes[record.ID] = record
	return record, nil
}

func (s *Service) GetProject(_ context.Context, input GetProjectInput) (project.Project, error) {
	if s == nil || s.store == nil {
		return project.Project{}, errors.New("projectapp: store is required")
	}
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return project.Project{}, errors.New("projectapp: project_id is required")
	}
	record, ok := s.store.Projects[projectID]
	if !ok {
		return project.Project{}, errors.New("projectapp: project not found")
	}
	return record, nil
}

func (s *Service) ListProjects(_ context.Context, input ListProjectsInput) ([]project.Project, error) {
	if s == nil || s.store == nil {
		return nil, errors.New("projectapp: store is required")
	}
	organizationID := strings.TrimSpace(input.OrganizationID)
	if organizationID == "" {
		return nil, errors.New("projectapp: org_id is required")
	}

	projects := make([]project.Project, 0)
	for _, record := range s.store.Projects {
		if record.OrganizationID == organizationID {
			projects = append(projects, record)
		}
	}

	sort.Slice(projects, func(i, j int) bool {
		if projects[i].CreatedAt.Equal(projects[j].CreatedAt) {
			return projects[i].ID < projects[j].ID
		}
		return projects[i].CreatedAt.Before(projects[j].CreatedAt)
	})

	return projects, nil
}

func (s *Service) ListEpisodes(_ context.Context, input ListEpisodesInput) ([]project.Episode, error) {
	if s == nil || s.store == nil {
		return nil, errors.New("projectapp: store is required")
	}
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return nil, errors.New("projectapp: project_id is required")
	}

	episodes := make([]project.Episode, 0)
	for _, record := range s.store.Episodes {
		if record.ProjectID == projectID {
			episodes = append(episodes, record)
		}
	}

	sort.Slice(episodes, func(i, j int) bool {
		if episodes[i].EpisodeNo == episodes[j].EpisodeNo {
			return episodes[i].ID < episodes[j].ID
		}
		return episodes[i].EpisodeNo < episodes[j].EpisodeNo
	})

	return episodes, nil
}
