package db

import (
	"fmt"
	"sync"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
)

type Handle struct{}

func NewHandle() Handle {
	return Handle{}
}

type MemoryStore struct {
	mu sync.RWMutex

	nextProjectID  int
	nextEpisodeID  int
	nextSceneID    int
	nextShotID     int
	nextSnapshotID int
	nextGroupID    int

	Projects       map[string]project.Project
	Episodes       map[string]project.Episode
	Scenes         map[string]content.Scene
	Shots          map[string]content.Shot
	Snapshots      map[string]content.Snapshot
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		Projects:  make(map[string]project.Project),
		Episodes:  make(map[string]project.Episode),
		Scenes:    make(map[string]content.Scene),
		Shots:     make(map[string]content.Shot),
		Snapshots: make(map[string]content.Snapshot),
	}
}

func (s *MemoryStore) NextProjectID() string {
	s.nextProjectID++
	return fmt.Sprintf("project-%d", s.nextProjectID)
}

func (s *MemoryStore) NextEpisodeID() string {
	s.nextEpisodeID++
	return fmt.Sprintf("episode-%d", s.nextEpisodeID)
}

func (s *MemoryStore) NextSceneID() string {
	s.nextSceneID++
	return fmt.Sprintf("scene-%d", s.nextSceneID)
}

func (s *MemoryStore) NextShotID() string {
	s.nextShotID++
	return fmt.Sprintf("shot-%d", s.nextShotID)
}

func (s *MemoryStore) NextSnapshotID() string {
	s.nextSnapshotID++
	return fmt.Sprintf("snapshot-%d", s.nextSnapshotID)
}

func (s *MemoryStore) NextTranslationGroupID() string {
	s.nextGroupID++
	return fmt.Sprintf("translation-group-%d", s.nextGroupID)
}
