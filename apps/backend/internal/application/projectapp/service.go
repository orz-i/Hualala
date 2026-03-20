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
	record := project.Project{
		ID:                      s.store.NextProjectID(),
		OrganizationID:          strings.TrimSpace(input.OrganizationID),
		OwnerUserID:             strings.TrimSpace(input.OwnerUserID),
		Title:                   strings.TrimSpace(input.Title),
		Status:                  strings.TrimSpace(input.Status),
		CurrentStage:            strings.TrimSpace(input.CurrentStage),
		PrimaryContentLocale:    strings.TrimSpace(input.PrimaryContentLocale),
		SupportedContentLocales: append([]string(nil), input.SupportedContentLocales...),
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
