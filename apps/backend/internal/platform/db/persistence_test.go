package db

import (
	"context"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/project"
)

type fakePersister struct {
	snapshot *Snapshot
}

func (f *fakePersister) Load(_ context.Context) (*Snapshot, error) {
	if f.snapshot == nil {
		return nil, nil
	}
	cloned := *f.snapshot
	return &cloned, nil
}

func (f *fakePersister) Save(_ context.Context, snapshot Snapshot) error {
	cloned := snapshot
	f.snapshot = &cloned
	return nil
}

func TestMemoryStorePersistsAndReloadsSnapshot(t *testing.T) {
	ctx := context.Background()
	persister := &fakePersister{}

	store, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore returned error: %v", err)
	}

	now := time.Now().UTC().Round(time.Second)
	projectID := store.NextProjectID()
	store.Projects[projectID] = project.Project{
		ID:                   projectID,
		OrganizationID:       "org-local-1",
		OwnerUserID:          "user-local-1",
		Title:                "Phase 2 Persistent Project",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := store.Save(ctx); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if persister.snapshot == nil {
		t.Fatalf("expected persister to receive a snapshot")
	}

	reloaded, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore reload returned error: %v", err)
	}

	gotProject, ok := reloaded.Projects[projectID]
	if !ok {
		t.Fatalf("expected project %q to be restored", projectID)
	}
	if gotProject.Title != "Phase 2 Persistent Project" {
		t.Fatalf("expected restored project title %q, got %q", "Phase 2 Persistent Project", gotProject.Title)
	}

	nextProjectID := reloaded.NextProjectID()
	if nextProjectID == projectID {
		t.Fatalf("expected id generator to advance past %q", projectID)
	}
}
