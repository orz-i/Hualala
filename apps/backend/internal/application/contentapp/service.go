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

type GetShotInput struct {
	ShotID string
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) CreateScene(_ context.Context, input CreateSceneInput) (content.Scene, error) {
	if input.SceneNo <= 0 {
		return content.Scene{}, errors.New("scene_no must be greater than 0")
	}

	now := time.Now().UTC()

	scene := content.Scene{
		ID:        s.store.NextSceneID(),
		ProjectID: input.ProjectID,
		EpisodeID: input.EpisodeID,
		SceneNo:   input.SceneNo,
		Code:      fmt.Sprintf("SCENE-%03d", input.SceneNo),
		Title:     input.Title,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.store.Scenes[scene.ID] = scene
	return scene, nil
}

func (s *Service) CreateShot(_ context.Context, input CreateShotInput) (content.Shot, error) {
	if input.ShotNo <= 0 {
		return content.Shot{}, errors.New("shot_no must be greater than 0")
	}

	now := time.Now().UTC()

	scene, ok := s.store.Scenes[input.SceneID]
	if !ok {
		return content.Shot{}, fmt.Errorf("scene %q not found", input.SceneID)
	}

	shot := content.Shot{
		ID:           s.store.NextShotID(),
		SceneID:      input.SceneID,
		ShotNo:       input.ShotNo,
		Code:         fmt.Sprintf("%s-SHOT-%03d", scene.Code, input.ShotNo),
		Title:        input.Title,
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

func (s *Service) ListSceneShots(_ context.Context, input ListSceneShotsInput) ([]content.Shot, error) {
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
	shot, ok := s.store.Shots[input.ShotID]
	if !ok {
		return content.Shot{}, fmt.Errorf("shot %q not found", input.ShotID)
	}

	return shot, nil
}
