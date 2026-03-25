package db

import (
	"context"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/org"
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

func TestMemoryStorePersistsAndReloadsAuthOrgSnapshot(t *testing.T) {
	ctx := context.Background()
	persister := &fakePersister{}

	store, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore returned error: %v", err)
	}

	store.Organizations[DefaultDevOrganizationID] = org.Organization{
		ID:                   DefaultDevOrganizationID,
		Slug:                 "dev-org",
		DisplayName:          "Development Organization",
		DefaultUILocale:      "zh-CN",
		DefaultContentLocale: "zh-CN",
	}
	store.Users[DefaultDevUserID] = auth.User{
		ID:                DefaultDevUserID,
		Email:             "dev-user@hualala.local",
		DisplayName:       "Development Operator",
		PreferredUILocale: "en-US",
		Timezone:          "Asia/Shanghai",
	}
	store.Roles[DefaultDevRoleID] = org.Role{
		ID:          DefaultDevRoleID,
		OrgID:       DefaultDevOrganizationID,
		Code:        "admin",
		DisplayName: "Administrator",
	}
	store.Memberships[DefaultDevMembershipID] = org.Member{
		ID:     DefaultDevMembershipID,
		OrgID:  DefaultDevOrganizationID,
		UserID: DefaultDevUserID,
		RoleID: DefaultDevRoleID,
		Status: "active",
	}
	store.RolePermissions[DefaultDevRoleID] = []string{"session.read", "org.members.read"}

	if err := store.Save(ctx); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	reloaded, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore reload returned error: %v", err)
	}

	user, ok := reloaded.Users[DefaultDevUserID]
	if !ok {
		t.Fatalf("expected user %q to be restored", DefaultDevUserID)
	}
	if got := user.Timezone; got != "Asia/Shanghai" {
		t.Fatalf("expected restored timezone %q, got %q", "Asia/Shanghai", got)
	}
	if got := reloaded.RolePermissions[DefaultDevRoleID]; len(got) != 2 {
		t.Fatalf("expected 2 restored role permissions, got %v", got)
	}
}

func TestMemoryStorePersistsAndReloadsCollaborationAndPreviewSnapshot(t *testing.T) {
	ctx := context.Background()
	persister := &fakePersister{}

	store, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore returned error: %v", err)
	}

	now := time.Now().UTC().Round(time.Second)
	sessionID := store.NextCollaborationSessionID()
	assemblyID := store.NextPreviewAssemblyID()
	store.CollaborationSessions[sessionID] = content.CollaborationSession{
		ID:               sessionID,
		OwnerType:        "shot",
		OwnerID:          "shot-1",
		DraftVersion:     4,
		LockHolderUserID: "user-1",
		ConflictSummary:  "",
		CreatedAt:        now,
		UpdatedAt:        now,
		LeaseExpiresAt:   now.Add(2 * time.Minute),
	}
	presenceID := store.NextCollaborationPresenceID()
	store.CollaborationPresences[presenceID] = content.CollaborationPresence{
		ID:             presenceID,
		SessionID:      sessionID,
		UserID:         "user-1",
		Status:         "editing",
		LastSeenAt:     now,
		LeaseExpiresAt: now.Add(2 * time.Minute),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	store.PreviewAssemblies[assemblyID] = project.PreviewAssembly{
		ID:        assemblyID,
		ProjectID: "project-1",
		EpisodeID: "episode-1",
		Status:    "ready",
		CreatedAt: now,
		UpdatedAt: now,
	}
	itemID := store.NextPreviewAssemblyItemID()
	store.PreviewAssemblyItems[itemID] = project.PreviewAssemblyItem{
		ID:             itemID,
		AssemblyID:     assemblyID,
		ShotID:         "shot-1",
		PrimaryAssetID: "asset-1",
		SourceRunID:    "run-1",
		Sequence:       1,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := store.Save(ctx); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	reloaded, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore reload returned error: %v", err)
	}

	session, ok := reloaded.CollaborationSessions[sessionID]
	if !ok {
		t.Fatalf("expected collaboration session %q to be restored", sessionID)
	}
	if got := session.LockHolderUserID; got != "user-1" {
		t.Fatalf("expected restored lock holder %q, got %q", "user-1", got)
	}
	if got := len(reloaded.CollaborationPresences); got != 1 {
		t.Fatalf("expected 1 restored collaboration presence, got %d", got)
	}
	assembly, ok := reloaded.PreviewAssemblies[assemblyID]
	if !ok {
		t.Fatalf("expected preview assembly %q to be restored", assemblyID)
	}
	if got := assembly.Status; got != "ready" {
		t.Fatalf("expected restored preview assembly status %q, got %q", "ready", got)
	}
	if got := len(reloaded.PreviewAssemblyItems); got != 1 {
		t.Fatalf("expected 1 restored preview assembly item, got %d", got)
	}
}

func TestMemoryStorePersistsAndReloadsAudioTimelineSnapshot(t *testing.T) {
	ctx := context.Background()
	persister := &fakePersister{}

	store, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore returned error: %v", err)
	}

	now := time.Now().UTC().Round(time.Second)
	timelineID := store.NextAudioTimelineID()
	trackID := store.NextAudioTrackID()
	clipID := store.NextAudioClipID()
	assetID := store.NextMediaAssetID()

	store.MediaAssets[assetID] = asset.MediaAsset{
		ID:         assetID,
		OrgID:      DefaultDevOrganizationID,
		ProjectID:  "project-audio-1",
		MediaType:  "audio",
		SourceType: "workflow_import",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	store.AudioTimelines[timelineID] = project.AudioTimeline{
		ID:                  timelineID,
		ProjectID:           "project-audio-1",
		EpisodeID:           "episode-audio-1",
		Status:              "ready",
		RenderWorkflowRunID: "workflow-run-1",
		RenderStatus:        "queued",
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	store.AudioTracks[trackID] = project.AudioTrack{
		ID:            trackID,
		TimelineID:    timelineID,
		TrackType:     "dialogue",
		DisplayName:   "对白",
		Sequence:      1,
		VolumePercent: 100,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	store.AudioClips[clipID] = project.AudioClip{
		ID:          clipID,
		TrackID:     trackID,
		AssetID:     assetID,
		SourceRunID: "workflow-run-1",
		Sequence:    1,
		StartMs:     0,
		DurationMs:  12000,
		TrimInMs:    0,
		TrimOutMs:   120,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := store.Save(ctx); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	reloaded, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore reload returned error: %v", err)
	}

	timeline, ok := reloaded.AudioTimelines[timelineID]
	if !ok {
		t.Fatalf("expected audio timeline %q to be restored", timelineID)
	}
	if got := timeline.RenderStatus; got != "queued" {
		t.Fatalf("expected restored render status %q, got %q", "queued", got)
	}
	if got := len(reloaded.AudioTracks); got != 1 {
		t.Fatalf("expected 1 restored audio track, got %d", got)
	}
	if got := len(reloaded.AudioClips); got != 1 {
		t.Fatalf("expected 1 restored audio clip, got %d", got)
	}
	if got := reloaded.AudioClips[clipID].DurationMs; got != 12000 {
		t.Fatalf("expected restored audio duration %d, got %d", 12000, got)
	}
}

func TestMemoryStorePersistsAndReloadsPreviewRuntimeSnapshot(t *testing.T) {
	ctx := context.Background()
	persister := &fakePersister{}

	store, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore returned error: %v", err)
	}

	now := time.Now().UTC().Round(time.Second)
	runtimeID := store.NextPreviewRuntimeID()
	store.PreviewRuntimes[runtimeID] = project.PreviewRuntime{
		ID:                  runtimeID,
		ProjectID:           "project-preview-1",
		EpisodeID:           "episode-preview-1",
		AssemblyID:          "assembly-preview-1",
		Status:              "queued",
		RenderWorkflowRunID: "workflow-run-preview-1",
		RenderStatus:        "queued",
		PlaybackAssetID:     "playback-asset-1",
		ExportAssetID:       "export-asset-1",
		ResolvedLocale:      "en-US",
		Playback: project.PreviewPlaybackDelivery{
			DeliveryMode: "file",
			PlaybackURL:  "https://cdn.example.com/playback.mp4",
			PosterURL:    "https://cdn.example.com/playback.jpg",
			DurationMs:   32000,
		},
		ExportOutput: project.PreviewExportDelivery{
			DownloadURL: "https://cdn.example.com/export.mp4",
			MimeType:    "video/mp4",
			FileName:    "export.mp4",
			SizeBytes:   4096,
		},
		LastErrorCode:    "preview_render_failed",
		LastErrorMessage: "stale failure",
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	if err := store.Save(ctx); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	reloaded, err := NewPersistentMemoryStore(ctx, persister)
	if err != nil {
		t.Fatalf("NewPersistentMemoryStore reload returned error: %v", err)
	}

	record, ok := reloaded.PreviewRuntimes[runtimeID]
	if !ok {
		t.Fatalf("expected preview runtime %q to be restored", runtimeID)
	}
	if got := record.RenderStatus; got != "queued" {
		t.Fatalf("expected restored render status %q, got %q", "queued", got)
	}
	if got := record.ResolvedLocale; got != "en-US" {
		t.Fatalf("expected restored resolved locale %q, got %q", "en-US", got)
	}
	if got := record.Playback.DeliveryMode; got != "file" {
		t.Fatalf("expected restored delivery mode %q, got %q", "file", got)
	}
	if got := record.Playback.PlaybackURL; got != "https://cdn.example.com/playback.mp4" {
		t.Fatalf("expected restored playback url %q, got %q", "https://cdn.example.com/playback.mp4", got)
	}
	if got := record.ExportOutput.DownloadURL; got != "https://cdn.example.com/export.mp4" {
		t.Fatalf("expected restored export download url %q, got %q", "https://cdn.example.com/export.mp4", got)
	}
	if got := record.LastErrorCode; got != "preview_render_failed" {
		t.Fatalf("expected restored last_error_code %q, got %q", "preview_render_failed", got)
	}
	if got := record.LastErrorMessage; got != "stale failure" {
		t.Fatalf("expected restored last_error_message %q, got %q", "stale failure", got)
	}
}
