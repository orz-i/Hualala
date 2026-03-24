package contentapp

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	repo      db.ProjectContentRepository
	publisher *events.Publisher
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
	SnapshotKind  string
	Body          string
}

type CreateLocalizedSnapshotInput struct {
	SourceSnapshotID string
	ContentLocale    string
	SnapshotKind     string
	Body             string
}

type ListScenesInput struct {
	ProjectID     string
	EpisodeID     string
	DisplayLocale string
}

type ListSceneShotsInput struct {
	SceneID       string
	DisplayLocale string
}

type GetSceneInput struct {
	SceneID       string
	DisplayLocale string
}

type GetShotInput struct {
	ShotID        string
	DisplayLocale string
}

type UpdateShotStructureInput struct {
	ShotID        string
	Title         string
	ContentLocale string
}

type CollaborationSessionState struct {
	Session   content.CollaborationSession
	Presences []content.CollaborationPresence
}

type GetCollaborationSessionInput struct {
	OwnerType string
	OwnerID   string
}

type UpsertCollaborationLeaseInput struct {
	OwnerType       string
	OwnerID         string
	ActorUserID     string
	PresenceStatus  string
	DraftVersion    uint32
	LeaseTTLSeconds uint32
}

type ReleaseCollaborationLeaseInput struct {
	OwnerType       string
	OwnerID         string
	ActorUserID     string
	ConflictSummary string
}

func NewService(repo db.ProjectContentRepository, publisher *events.Publisher) *Service {
	return &Service{
		repo:      repo,
		publisher: publisher,
	}
}

func (s *Service) CreateScene(ctx context.Context, input CreateSceneInput) (content.Scene, error) {
	if s == nil || s.repo == nil {
		return content.Scene{}, errors.New("contentapp: repository is required")
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
	projectRecord, ok := s.repo.GetProject(projectID)
	if !ok {
		return content.Scene{}, errors.New("contentapp: project not found")
	}
	if _, ok := s.repo.GetEpisode(episodeID); !ok {
		return content.Scene{}, errors.New("contentapp: episode not found")
	}

	now := time.Now().UTC()

	scene := content.Scene{
		ID:           s.repo.GenerateSceneID(),
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

	if err := s.repo.SaveScene(ctx, scene); err != nil {
		return content.Scene{}, err
	}
	return scene, nil
}

func (s *Service) CreateShot(ctx context.Context, input CreateShotInput) (content.Shot, error) {
	if s == nil || s.repo == nil {
		return content.Shot{}, errors.New("contentapp: repository is required")
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

	scene, ok := s.repo.GetScene(sceneID)
	if !ok {
		return content.Shot{}, fmt.Errorf("contentapp: scene %q not found", sceneID)
	}

	shot := content.Shot{
		ID:           s.repo.GenerateShotID(),
		SceneID:      sceneID,
		ShotNo:       input.ShotNo,
		Code:         fmt.Sprintf("%s-SHOT-%03d", scene.Code, input.ShotNo),
		Title:        title,
		SourceLocale: scene.SourceLocale,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.SaveShot(ctx, shot); err != nil {
		return content.Shot{}, err
	}
	return shot, nil
}

func (s *Service) CreateContentSnapshot(ctx context.Context, input CreateContentSnapshotInput) (content.Snapshot, error) {
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
	snapshotKind, err := normalizeSnapshotKind(input.SnapshotKind)
	if err != nil {
		return content.Snapshot{}, err
	}
	if err := s.validateSnapshotOwner(snapshotKind, input.OwnerType); err != nil {
		return content.Snapshot{}, err
	}

	now := time.Now().UTC()

	snapshot := content.Snapshot{
		ID:                 s.repo.GenerateSnapshotID(),
		OwnerType:          input.OwnerType,
		OwnerID:            input.OwnerID,
		SnapshotKind:       snapshotKind,
		Locale:             input.ContentLocale,
		TranslationGroupID: s.repo.GenerateTranslationGroupID(),
		TranslationStatus:  "source",
		Body:               input.Body,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	if err := s.repo.SaveSnapshot(ctx, snapshot); err != nil {
		return content.Snapshot{}, err
	}
	return snapshot, nil
}

func (s *Service) CreateLocalizedSnapshot(ctx context.Context, input CreateLocalizedSnapshotInput) (content.Snapshot, error) {
	if strings.TrimSpace(input.ContentLocale) == "" {
		return content.Snapshot{}, errors.New("content_locale is required")
	}
	if strings.TrimSpace(input.Body) == "" {
		return content.Snapshot{}, errors.New("body is required")
	}

	now := time.Now().UTC()

	sourceSnapshot, ok := s.repo.GetSnapshot(input.SourceSnapshotID)
	if !ok {
		return content.Snapshot{}, fmt.Errorf("source snapshot %q not found", input.SourceSnapshotID)
	}
	sourceSnapshotKind, err := normalizeStoredSnapshotKind(sourceSnapshot.SnapshotKind)
	if err != nil {
		return content.Snapshot{}, err
	}
	requestedSnapshotKind := strings.TrimSpace(input.SnapshotKind)
	if requestedSnapshotKind == "" {
		requestedSnapshotKind = sourceSnapshotKind
	} else {
		requestedSnapshotKind, err = normalizeSnapshotKind(requestedSnapshotKind)
		if err != nil {
			return content.Snapshot{}, err
		}
	}
	if requestedSnapshotKind != sourceSnapshotKind {
		return content.Snapshot{}, errors.New("contentapp: failed precondition: localized snapshot kind must match source snapshot")
	}
	if sourceSnapshotKind == content.SnapshotKindTitle {
		switch strings.TrimSpace(sourceSnapshot.OwnerType) {
		case "scene", "shot":
		default:
			return content.Snapshot{}, errors.New("contentapp: failed precondition: title source snapshot owner must be scene or shot")
		}
	}

	snapshot := content.Snapshot{
		ID:                 s.repo.GenerateSnapshotID(),
		OwnerType:          sourceSnapshot.OwnerType,
		OwnerID:            sourceSnapshot.OwnerID,
		SnapshotKind:       sourceSnapshotKind,
		Locale:             input.ContentLocale,
		SourceSnapshotID:   sourceSnapshot.ID,
		TranslationGroupID: sourceSnapshot.TranslationGroupID,
		TranslationStatus:  "draft_translation",
		Body:               input.Body,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	if err := s.repo.SaveSnapshot(ctx, snapshot); err != nil {
		return content.Snapshot{}, err
	}
	return snapshot, nil
}

func (s *Service) ListScenes(_ context.Context, input ListScenesInput) ([]content.Scene, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("contentapp: repository is required")
	}
	return s.resolveSceneTitles(s.repo.ListScenes(input.ProjectID, input.EpisodeID), input.DisplayLocale), nil
}

func (s *Service) GetScene(_ context.Context, input GetSceneInput) (content.Scene, error) {
	if s == nil || s.repo == nil {
		return content.Scene{}, errors.New("contentapp: repository is required")
	}
	sceneID := strings.TrimSpace(input.SceneID)
	if sceneID == "" {
		return content.Scene{}, errors.New("contentapp: scene_id is required")
	}
	record, ok := s.repo.GetScene(sceneID)
	if !ok {
		return content.Scene{}, fmt.Errorf("contentapp: scene %q not found", sceneID)
	}
	return s.resolveSceneTitle(record, input.DisplayLocale), nil
}

func (s *Service) ListSceneShots(_ context.Context, input ListSceneShotsInput) ([]content.Shot, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("contentapp: repository is required")
	}
	return s.resolveShotTitles(s.repo.ListShotsByScene(input.SceneID), input.DisplayLocale), nil
}

func (s *Service) GetShot(_ context.Context, input GetShotInput) (content.Shot, error) {
	if s == nil || s.repo == nil {
		return content.Shot{}, errors.New("contentapp: repository is required")
	}
	shotID := strings.TrimSpace(input.ShotID)
	if shotID == "" {
		return content.Shot{}, errors.New("contentapp: shot_id is required")
	}
	shot, ok := s.repo.GetShot(shotID)
	if !ok {
		return content.Shot{}, fmt.Errorf("contentapp: shot %q not found", shotID)
	}

	return s.resolveShotTitle(shot, input.DisplayLocale), nil
}

func (s *Service) UpdateShotStructure(ctx context.Context, input UpdateShotStructureInput) (content.Shot, error) {
	if s == nil || s.repo == nil {
		return content.Shot{}, errors.New("contentapp: repository is required")
	}
	shotID := strings.TrimSpace(input.ShotID)
	if shotID == "" {
		return content.Shot{}, errors.New("contentapp: shot_id is required")
	}
	record, ok := s.repo.GetShot(shotID)
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
	if err := s.repo.SaveShot(ctx, record); err != nil {
		return content.Shot{}, err
	}
	return record, nil
}

func (s *Service) GetCollaborationSession(ctx context.Context, input GetCollaborationSessionInput) (CollaborationSessionState, error) {
	if s == nil || s.repo == nil {
		return CollaborationSessionState{}, errors.New("contentapp: repository is required")
	}
	ownerType, ownerID, err := s.normalizeCollaborationOwner(input.OwnerType, input.OwnerID)
	if err != nil {
		return CollaborationSessionState{}, err
	}
	record, err := s.ensureCollaborationSession(ctx, ownerType, ownerID)
	if err != nil {
		return CollaborationSessionState{}, err
	}
	return s.buildCollaborationSessionState(record), nil
}

func (s *Service) UpsertCollaborationLease(ctx context.Context, input UpsertCollaborationLeaseInput) (CollaborationSessionState, error) {
	if s == nil || s.repo == nil {
		return CollaborationSessionState{}, errors.New("contentapp: repository is required")
	}
	ownerType, ownerID, err := s.normalizeCollaborationOwner(input.OwnerType, input.OwnerID)
	if err != nil {
		return CollaborationSessionState{}, err
	}
	actorUserID := strings.TrimSpace(input.ActorUserID)
	if actorUserID == "" {
		return CollaborationSessionState{}, errors.New("contentapp: actor_user_id is required")
	}

	record, err := s.ensureCollaborationSession(ctx, ownerType, ownerID)
	if err != nil {
		return CollaborationSessionState{}, err
	}

	now := time.Now().UTC()
	leaseExpiresAt := now.Add(resolveLeaseTTL(input.LeaseTTLSeconds))
	if err := s.upsertPresence(ctx, record.ID, actorUserID, input.PresenceStatus, leaseExpiresAt); err != nil {
		return CollaborationSessionState{}, err
	}

	if record.LockHolderUserID != "" && record.LockHolderUserID != actorUserID && record.LeaseExpiresAt.After(now) {
		record.ConflictSummary = fmt.Sprintf("lock held by %s", record.LockHolderUserID)
		record.UpdatedAt = now
		if err := s.repo.SaveCollaborationSession(ctx, record); err != nil {
			return CollaborationSessionState{}, err
		}
		return CollaborationSessionState{}, errors.New("contentapp: failed precondition: lock held by another user")
	}

	record.LockHolderUserID = actorUserID
	record.LeaseExpiresAt = leaseExpiresAt
	record.ConflictSummary = ""
	if input.DraftVersion > 0 {
		record.DraftVersion = input.DraftVersion
	} else if record.DraftVersion == 0 {
		record.DraftVersion = 1
	}
	record.UpdatedAt = now
	if err := s.repo.SaveCollaborationSession(ctx, record); err != nil {
		return CollaborationSessionState{}, err
	}
	state := s.buildCollaborationSessionState(record)
	s.publishCollaborationEvent(ctx, record.OwnerType, record.OwnerID, state, actorUserID, "lease_claimed")
	return state, nil
}

func (s *Service) ReleaseCollaborationLease(ctx context.Context, input ReleaseCollaborationLeaseInput) (CollaborationSessionState, error) {
	if s == nil || s.repo == nil {
		return CollaborationSessionState{}, errors.New("contentapp: repository is required")
	}
	ownerType, ownerID, err := s.normalizeCollaborationOwner(input.OwnerType, input.OwnerID)
	if err != nil {
		return CollaborationSessionState{}, err
	}
	actorUserID := strings.TrimSpace(input.ActorUserID)
	if actorUserID == "" {
		return CollaborationSessionState{}, errors.New("contentapp: actor_user_id is required")
	}
	record, ok := s.repo.GetCollaborationSession(ownerType, ownerID)
	if !ok {
		return CollaborationSessionState{}, errors.New("contentapp: failed precondition: collaboration session not found")
	}
	now := time.Now().UTC()
	if record.LockHolderUserID == "" || !record.LeaseExpiresAt.After(now) {
		return CollaborationSessionState{}, errors.New("contentapp: failed precondition: active lease not found")
	}
	if record.LockHolderUserID != actorUserID {
		return CollaborationSessionState{}, errors.New("contentapp: failed precondition: lock held by another user")
	}

	record.LockHolderUserID = ""
	record.LeaseExpiresAt = time.Time{}
	record.ConflictSummary = strings.TrimSpace(input.ConflictSummary)
	record.UpdatedAt = now
	if err := s.repo.SaveCollaborationSession(ctx, record); err != nil {
		return CollaborationSessionState{}, err
	}
	if err := s.upsertPresence(ctx, record.ID, actorUserID, "released", now); err != nil {
		return CollaborationSessionState{}, err
	}
	state := s.buildCollaborationSessionState(record)
	s.publishCollaborationEvent(ctx, record.OwnerType, record.OwnerID, state, actorUserID, "lease_released")
	return state, nil
}

func (s *Service) normalizeCollaborationOwner(ownerType string, ownerID string) (string, string, error) {
	normalizedType := strings.TrimSpace(ownerType)
	normalizedID := strings.TrimSpace(ownerID)
	if normalizedType == "" {
		return "", "", errors.New("contentapp: owner_type is required")
	}
	if normalizedID == "" {
		return "", "", errors.New("contentapp: owner_id is required")
	}
	switch normalizedType {
	case "project":
		if _, ok := s.repo.GetProject(normalizedID); !ok {
			return "", "", fmt.Errorf("contentapp: project %q not found", normalizedID)
		}
	case "episode":
		if _, ok := s.repo.GetEpisode(normalizedID); !ok {
			return "", "", fmt.Errorf("contentapp: episode %q not found", normalizedID)
		}
	case "scene":
		if _, ok := s.repo.GetScene(normalizedID); !ok {
			return "", "", fmt.Errorf("contentapp: scene %q not found", normalizedID)
		}
	case "shot":
		if _, ok := s.repo.GetShot(normalizedID); !ok {
			return "", "", fmt.Errorf("contentapp: shot %q not found", normalizedID)
		}
	default:
		return "", "", fmt.Errorf("contentapp: owner_type %q is invalid", normalizedType)
	}
	return normalizedType, normalizedID, nil
}

func (s *Service) ensureCollaborationSession(ctx context.Context, ownerType string, ownerID string) (content.CollaborationSession, error) {
	if record, ok := s.repo.GetCollaborationSession(ownerType, ownerID); ok {
		return record, nil
	}
	now := time.Now().UTC()
	record := content.CollaborationSession{
		ID:        s.repo.GenerateCollaborationSessionID(),
		OwnerType: ownerType,
		OwnerID:   ownerID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.SaveCollaborationSession(ctx, record); err != nil {
		return content.CollaborationSession{}, err
	}
	return record, nil
}

func (s *Service) upsertPresence(ctx context.Context, sessionID string, userID string, status string, leaseExpiresAt time.Time) error {
	now := time.Now().UTC()
	record, ok := s.repo.GetCollaborationPresence(sessionID, userID)
	if !ok {
		record = content.CollaborationPresence{
			ID:        s.repo.GenerateCollaborationPresenceID(),
			SessionID: sessionID,
			UserID:    userID,
			CreatedAt: now,
		}
	}
	record.Status = defaultPresenceStatus(status)
	record.LastSeenAt = now
	record.LeaseExpiresAt = leaseExpiresAt
	record.UpdatedAt = now
	return s.repo.SaveCollaborationPresence(ctx, record)
}

func (s *Service) buildCollaborationSessionState(record content.CollaborationSession) CollaborationSessionState {
	return CollaborationSessionState{
		Session:   record,
		Presences: s.repo.ListCollaborationPresences(record.ID),
	}
}

func (s *Service) publishCollaborationEvent(ctx context.Context, ownerType string, ownerID string, state CollaborationSessionState, changedUserID string, changeKind string) {
	if s == nil || s.publisher == nil {
		return
	}
	organizationID, projectID, err := s.repo.GetCollaborationScope(ownerType, ownerID)
	if err != nil {
		log.Printf("contentapp: could not resolve collaboration scope for owner %s/%s: %v", ownerType, ownerID, err)
		return
	}
	events.PublishCollaborationUpdated(ctx, s.publisher, events.PublishCollaborationUpdatedInput{
		OrganizationID: organizationID,
		ProjectID:      projectID,
		ChangedUserID:  changedUserID,
		ChangeKind:     changeKind,
		Session:        state.Session,
		Presences:      state.Presences,
	})
}

func resolveLeaseTTL(raw uint32) time.Duration {
	if raw == 0 {
		raw = 300
	}
	return time.Duration(raw) * time.Second
}

func defaultPresenceStatus(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "editing"
	}
	return trimmed
}
