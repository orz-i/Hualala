package contentapp

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
}

type CreateSceneInput struct {
	ProjectID string
	EpisodeID string
	SceneNo   int
	Title     string
}

type CreateShotInput struct {
	SceneID string
	ShotNo  int
	Title   string
}

type CreateContentSnapshotInput struct {
	OwnerType     string
	OwnerID       string
	ContentLocale string
	Body          string
}

type CreateLocalizedSnapshotInput struct {
	SourceSnapshotID string
	ContentLocale    string
	Body             string
}

type ListScenesInput struct {
	ProjectID string
	EpisodeID string
}

type ListSceneShotsInput struct {
	SceneID string
}

type GetSceneInput struct {
	SceneID string
}

type GetShotInput struct {
	ShotID string
}

type UpdateShotStructureInput struct {
	ShotID        string
	Title         string
	ContentLocale string
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) CreateScene(_ context.Context, input CreateSceneInput) (content.Scene, error) {
	if s == nil || s.store == nil {
		return content.Scene{}, errors.New("contentapp: store is required")
	}
	projectID := strings.TrimSpace(input.ProjectID)
	episodeID := strings.TrimSpace(input.EpisodeID)
	title := strings.TrimSpace(input.Title)
	if projectID == "" {
		return content.Scene{}, errors.New("contentapp: project_id is required")
	}
	if episodeID == "" {
		return content.Scene{}, errors.New("contentapp: episode_id is required")
	}
	if title == "" {
		return content.Scene{}, errors.New("contentapp: title is required")
	}
	if input.SceneNo <= 0 {
		return content.Scene{}, errors.New("contentapp: scene_no must be greater than 0")
	}
	projectRecord, ok := s.store.Projects[projectID]
	if !ok {
		return content.Scene{}, errors.New("contentapp: project not found")
	}
	if _, ok := s.store.Episodes[episodeID]; !ok {
		return content.Scene{}, errors.New("contentapp: episode not found")
	}

	now := time.Now().UTC()

	scene := content.Scene{
		ID:           s.store.NextSceneID(),
		ProjectID:    projectID,
		EpisodeID:    episodeID,
		SceneNo:      input.SceneNo,
		Code:         fmt.Sprintf("SCENE-%03d", input.SceneNo),
		Title:        title,
		SourceLocale: strings.TrimSpace(projectRecord.PrimaryContentLocale),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if scene.SourceLocale == "" {
		scene.SourceLocale = "zh-CN"
	}

	s.store.Scenes[scene.ID] = scene
	return scene, nil
}

func (s *Service) CreateShot(_ context.Context, input CreateShotInput) (content.Shot, error) {
	if s == nil || s.store == nil {
		return content.Shot{}, errors.New("contentapp: store is required")
	}
	sceneID := strings.TrimSpace(input.SceneID)
	title := strings.TrimSpace(input.Title)
	if sceneID == "" {
		return content.Shot{}, errors.New("contentapp: scene_id is required")
	}
	if title == "" {
		return content.Shot{}, errors.New("contentapp: title is required")
	}
	if input.ShotNo <= 0 {
		return content.Shot{}, errors.New("contentapp: shot_no must be greater than 0")
	}

	now := time.Now().UTC()

	scene, ok := s.store.Scenes[sceneID]
	if !ok {
		return content.Shot{}, fmt.Errorf("contentapp: scene %q not found", sceneID)
	}

	shot := content.Shot{
		ID:           s.store.NextShotID(),
		SceneID:      sceneID,
		ShotNo:       input.ShotNo,
		Code:         fmt.Sprintf("%s-SHOT-%03d", scene.Code, input.ShotNo),
		Title:        title,
		SourceLocale: scene.SourceLocale,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	s.store.Shots[shot.ID] = shot
	return shot, nil
}

func (s *Service) CreateContentSnapshot(_ context.Context, input CreateContentSnapshotInput) (content.Snapshot, error) {
	if strings.TrimSpace(input.OwnerType) == "" {
		return content.Snapshot{}, errors.New("owner_type is required")
	}
	if strings.TrimSpace(input.OwnerID) == "" {
		return content.Snapshot{}, errors.New("owner_id is required")
	}
	if strings.TrimSpace(input.ContentLocale) == "" {
		return content.Snapshot{}, errors.New("content_locale is required")
	}
	if strings.TrimSpace(input.Body) == "" {
		return content.Snapshot{}, errors.New("body is required")
	}

	now := time.Now().UTC()

	snapshot := content.Snapshot{
		ID:                 s.store.NextSnapshotID(),
		OwnerType:          input.OwnerType,
		OwnerID:            input.OwnerID,
		Locale:             input.ContentLocale,
		TranslationGroupID: s.store.NextTranslationGroupID(),
		TranslationStatus:  "source",
		Body:               input.Body,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	s.store.Snapshots[snapshot.ID] = snapshot
	return snapshot, nil
}

func (s *Service) CreateLocalizedSnapshot(_ context.Context, input CreateLocalizedSnapshotInput) (content.Snapshot, error) {
	if strings.TrimSpace(input.ContentLocale) == "" {
		return content.Snapshot{}, errors.New("content_locale is required")
	}
	if strings.TrimSpace(input.Body) == "" {
		return content.Snapshot{}, errors.New("body is required")
	}

	now := time.Now().UTC()

	sourceSnapshot, ok := s.store.Snapshots[input.SourceSnapshotID]
	if !ok {
		return content.Snapshot{}, fmt.Errorf("source snapshot %q not found", input.SourceSnapshotID)
	}

	snapshot := content.Snapshot{
		ID:                 s.store.NextSnapshotID(),
		OwnerType:          sourceSnapshot.OwnerType,
		OwnerID:            sourceSnapshot.OwnerID,
		Locale:             input.ContentLocale,
		SourceSnapshotID:   sourceSnapshot.ID,
		TranslationGroupID: sourceSnapshot.TranslationGroupID,
		TranslationStatus:  "draft_translation",
		Body:               input.Body,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	s.store.Snapshots[snapshot.ID] = snapshot
	return snapshot, nil
}

func (s *Service) ListScenes(_ context.Context, input ListScenesInput) ([]content.Scene, error) {
	if s == nil || s.store == nil {
		return nil, errors.New("contentapp: store is required")
	}
	scenes := make([]content.Scene, 0)
	for _, scene := range s.store.Scenes {
		if scene.ProjectID == input.ProjectID && scene.EpisodeID == input.EpisodeID {
			scenes = append(scenes, scene)
		}
	}

	sort.Slice(scenes, func(i, j int) bool {
		if scenes[i].SceneNo == scenes[j].SceneNo {
			return scenes[i].ID < scenes[j].ID
		}
		return scenes[i].SceneNo < scenes[j].SceneNo
	})

	return scenes, nil
}

func (s *Service) GetScene(_ context.Context, input GetSceneInput) (content.Scene, error) {
	if s == nil || s.store == nil {
		return content.Scene{}, errors.New("contentapp: store is required")
	}
	sceneID := strings.TrimSpace(input.SceneID)
	if sceneID == "" {
		return content.Scene{}, errors.New("contentapp: scene_id is required")
	}
	record, ok := s.store.Scenes[sceneID]
	if !ok {
		return content.Scene{}, fmt.Errorf("contentapp: scene %q not found", sceneID)
	}
	return record, nil
}

func (s *Service) ListSceneShots(_ context.Context, input ListSceneShotsInput) ([]content.Shot, error) {
	if s == nil || s.store == nil {
		return nil, errors.New("contentapp: store is required")
	}
	shots := make([]content.Shot, 0)
	for _, shot := range s.store.Shots {
		if shot.SceneID == input.SceneID {
			shots = append(shots, shot)
		}
	}

	sort.Slice(shots, func(i, j int) bool {
		if shots[i].ShotNo == shots[j].ShotNo {
			return shots[i].ID < shots[j].ID
		}
		return shots[i].ShotNo < shots[j].ShotNo
	})

	return shots, nil
}

func (s *Service) GetShot(_ context.Context, input GetShotInput) (content.Shot, error) {
	if s == nil || s.store == nil {
		return content.Shot{}, errors.New("contentapp: store is required")
	}
	shotID := strings.TrimSpace(input.ShotID)
	if shotID == "" {
		return content.Shot{}, errors.New("contentapp: shot_id is required")
	}
	shot, ok := s.store.Shots[shotID]
	if !ok {
		return content.Shot{}, fmt.Errorf("contentapp: shot %q not found", shotID)
	}

	return shot, nil
}

func (s *Service) UpdateShotStructure(_ context.Context, input UpdateShotStructureInput) (content.Shot, error) {
	if s == nil || s.store == nil {
		return content.Shot{}, errors.New("contentapp: store is required")
	}
	shotID := strings.TrimSpace(input.ShotID)
	if shotID == "" {
		return content.Shot{}, errors.New("contentapp: shot_id is required")
	}
	record, ok := s.store.Shots[shotID]
	if !ok {
		return content.Shot{}, fmt.Errorf("contentapp: shot %q not found", shotID)
	}
	if title := strings.TrimSpace(input.Title); title != "" {
		record.Title = title
	}
	if locale := strings.TrimSpace(input.ContentLocale); locale != "" {
		record.SourceLocale = locale
	}
	record.UpdatedAt = time.Now().UTC()
	s.store.Shots[shotID] = record
	return record, nil
}
