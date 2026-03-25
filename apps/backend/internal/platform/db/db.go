package db

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Handle struct{}

func NewHandle() Handle {
	return Handle{}
}

type SnapshotPersister interface {
	Load(ctx context.Context) (*Snapshot, error)
	Save(ctx context.Context, snapshot Snapshot) error
}

type Snapshot struct {
	NextProjectID         int
	NextEpisodeID         int
	NextSceneID           int
	NextShotID            int
	NextSnapshotID        int
	NextGroupID           int
	NextCollaborationID   int
	NextPresenceID        int
	NextPreviewAssemblyID int
	NextPreviewItemID     int
	NextPreviewRuntimeID  int
	NextAudioTimelineID   int
	NextAudioTrackID      int
	NextAudioClipID       int
	NextExecutionID       int
	NextRunID             int
	NextImportBatchID     int
	NextImportBatchItemID int
	NextUploadSessionID   int
	NextUploadFileID      int
	NextAssetID           int
	NextVariantID         int
	NextCandidateID       int
	NextReviewID          int
	NextBudgetID          int
	NextUsageID           int
	NextBillingEventID    int
	NextEvaluationRunID   int
	NextWorkflowRunID     int
	NextWorkflowStepID    int
	NextJobID             int
	NextStateTransitionID int
	NextGatewayRequestID  int

	Organizations          map[string]org.Organization
	Users                  map[string]auth.User
	Roles                  map[string]org.Role
	Memberships            map[string]org.Member
	RolePermissions        map[string][]string
	Projects               map[string]project.Project
	Episodes               map[string]project.Episode
	Scenes                 map[string]content.Scene
	Shots                  map[string]content.Shot
	Snapshots              map[string]content.Snapshot
	CollaborationSessions  map[string]content.CollaborationSession
	CollaborationPresences map[string]content.CollaborationPresence
	PreviewAssemblies      map[string]project.PreviewAssembly
	PreviewAssemblyItems   map[string]project.PreviewAssemblyItem
	PreviewRuntimes        map[string]project.PreviewRuntime
	AudioTimelines         map[string]project.AudioTimeline
	AudioTracks            map[string]project.AudioTrack
	AudioClips             map[string]project.AudioClip
	ShotExecutions         map[string]execution.ShotExecution
	ShotExecutionRuns      map[string]execution.ShotExecutionRun
	ImportBatches          map[string]asset.ImportBatch
	ImportBatchItems       map[string]asset.ImportBatchItem
	UploadSessions         map[string]asset.UploadSession
	UploadFiles            map[string]asset.UploadFile
	MediaAssets            map[string]asset.MediaAsset
	MediaAssetVariants     map[string]asset.MediaAssetVariant
	CandidateAssets        map[string]asset.CandidateAsset
	Reviews                map[string]review.ShotReview
	EvaluationRuns         map[string]review.EvaluationRun
	Budgets                map[string]billing.ProjectBudget
	UsageRecords           map[string]billing.UsageRecord
	BillingEvents          map[string]billing.BillingEvent
	WorkflowRuns           map[string]workflow.WorkflowRun
	WorkflowSteps          map[string]workflow.WorkflowStep
	Jobs                   map[string]workflow.Job
	StateTransitions       map[string]workflow.StateTransition
	GatewayResults         map[string]gateway.GatewayResult
}

type MemoryStore struct {
	mu sync.RWMutex

	nextProjectID         int
	nextEpisodeID         int
	nextSceneID           int
	nextShotID            int
	nextSnapshotID        int
	nextGroupID           int
	nextCollaborationID   int
	nextPresenceID        int
	nextPreviewAssemblyID int
	nextPreviewItemID     int
	nextPreviewRuntimeID  int
	nextAudioTimelineID   int
	nextAudioTrackID      int
	nextAudioClipID       int
	nextExecutionID       int
	nextRunID             int
	nextImportBatchID     int
	nextImportBatchItemID int
	nextUploadSessionID   int
	nextUploadFileID      int
	nextAssetID           int
	nextVariantID         int
	nextCandidateID       int
	nextReviewID          int
	nextBudgetID          int
	nextUsageID           int
	nextBillingEventID    int
	nextEvaluationRunID   int
	nextWorkflowRunID     int
	nextWorkflowStepID    int
	nextJobID             int
	nextStateTransitionID int
	nextGatewayRequestID  int

	Organizations          map[string]org.Organization
	Users                  map[string]auth.User
	Roles                  map[string]org.Role
	Memberships            map[string]org.Member
	RolePermissions        map[string][]string
	Projects               map[string]project.Project
	Episodes               map[string]project.Episode
	Scenes                 map[string]content.Scene
	Shots                  map[string]content.Shot
	Snapshots              map[string]content.Snapshot
	CollaborationSessions  map[string]content.CollaborationSession
	CollaborationPresences map[string]content.CollaborationPresence
	PreviewAssemblies      map[string]project.PreviewAssembly
	PreviewAssemblyItems   map[string]project.PreviewAssemblyItem
	PreviewRuntimes        map[string]project.PreviewRuntime
	AudioTimelines         map[string]project.AudioTimeline
	AudioTracks            map[string]project.AudioTrack
	AudioClips             map[string]project.AudioClip
	ShotExecutions         map[string]execution.ShotExecution
	ShotExecutionRuns      map[string]execution.ShotExecutionRun
	ImportBatches          map[string]asset.ImportBatch
	ImportBatchItems       map[string]asset.ImportBatchItem
	UploadSessions         map[string]asset.UploadSession
	UploadFiles            map[string]asset.UploadFile
	MediaAssets            map[string]asset.MediaAsset
	MediaAssetVariants     map[string]asset.MediaAssetVariant
	CandidateAssets        map[string]asset.CandidateAsset
	Reviews                map[string]review.ShotReview
	EvaluationRuns         map[string]review.EvaluationRun
	Budgets                map[string]billing.ProjectBudget
	UsageRecords           map[string]billing.UsageRecord
	BillingEvents          map[string]billing.BillingEvent
	WorkflowRuns           map[string]workflow.WorkflowRun
	WorkflowSteps          map[string]workflow.WorkflowStep
	Jobs                   map[string]workflow.Job
	StateTransitions       map[string]workflow.StateTransition
	GatewayResults         map[string]gateway.GatewayResult
	EventPublisher         *events.Publisher
	persister              SnapshotPersister
	useUUIDIDs             bool
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		Organizations:          make(map[string]org.Organization),
		Users:                  make(map[string]auth.User),
		Roles:                  make(map[string]org.Role),
		Memberships:            make(map[string]org.Member),
		RolePermissions:        make(map[string][]string),
		Projects:               make(map[string]project.Project),
		Episodes:               make(map[string]project.Episode),
		Scenes:                 make(map[string]content.Scene),
		Shots:                  make(map[string]content.Shot),
		Snapshots:              make(map[string]content.Snapshot),
		CollaborationSessions:  make(map[string]content.CollaborationSession),
		CollaborationPresences: make(map[string]content.CollaborationPresence),
		PreviewAssemblies:      make(map[string]project.PreviewAssembly),
		PreviewAssemblyItems:   make(map[string]project.PreviewAssemblyItem),
		PreviewRuntimes:        make(map[string]project.PreviewRuntime),
		AudioTimelines:         make(map[string]project.AudioTimeline),
		AudioTracks:            make(map[string]project.AudioTrack),
		AudioClips:             make(map[string]project.AudioClip),
		ShotExecutions:         make(map[string]execution.ShotExecution),
		ShotExecutionRuns:      make(map[string]execution.ShotExecutionRun),
		ImportBatches:          make(map[string]asset.ImportBatch),
		ImportBatchItems:       make(map[string]asset.ImportBatchItem),
		UploadSessions:         make(map[string]asset.UploadSession),
		UploadFiles:            make(map[string]asset.UploadFile),
		MediaAssets:            make(map[string]asset.MediaAsset),
		MediaAssetVariants:     make(map[string]asset.MediaAssetVariant),
		CandidateAssets:        make(map[string]asset.CandidateAsset),
		Reviews:                make(map[string]review.ShotReview),
		EvaluationRuns:         make(map[string]review.EvaluationRun),
		Budgets:                make(map[string]billing.ProjectBudget),
		UsageRecords:           make(map[string]billing.UsageRecord),
		BillingEvents:          make(map[string]billing.BillingEvent),
		WorkflowRuns:           make(map[string]workflow.WorkflowRun),
		WorkflowSteps:          make(map[string]workflow.WorkflowStep),
		Jobs:                   make(map[string]workflow.Job),
		StateTransitions:       make(map[string]workflow.StateTransition),
		GatewayResults:         make(map[string]gateway.GatewayResult),
		EventPublisher:         events.NewPublisher(),
	}
}

func NewPersistentMemoryStore(ctx context.Context, persister SnapshotPersister) (*MemoryStore, error) {
	store := NewMemoryStore()
	store.persister = persister
	if persister == nil {
		return store, nil
	}

	snapshot, err := persister.Load(ctx)
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return store, nil
	}

	store.applySnapshot(*snapshot)
	return store, nil
}

func (s *MemoryStore) EnableUUIDIDs() {
	if s == nil {
		return
	}
	s.useUUIDIDs = true
}

func (s *MemoryStore) Save(ctx context.Context) error {
	if s == nil || s.persister == nil {
		return nil
	}
	return s.persister.Save(ctx, s.snapshot())
}

func (s *MemoryStore) Persist(ctx context.Context) error {
	return s.Save(ctx)
}

func (s *MemoryStore) Publisher() *events.Publisher {
	if s == nil {
		return nil
	}
	return s.EventPublisher
}

func (s *MemoryStore) snapshot() Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return Snapshot{
		NextProjectID:          s.nextProjectID,
		NextEpisodeID:          s.nextEpisodeID,
		NextSceneID:            s.nextSceneID,
		NextShotID:             s.nextShotID,
		NextSnapshotID:         s.nextSnapshotID,
		NextGroupID:            s.nextGroupID,
		NextCollaborationID:    s.nextCollaborationID,
		NextPresenceID:         s.nextPresenceID,
		NextPreviewAssemblyID:  s.nextPreviewAssemblyID,
		NextPreviewItemID:      s.nextPreviewItemID,
		NextPreviewRuntimeID:   s.nextPreviewRuntimeID,
		NextAudioTimelineID:    s.nextAudioTimelineID,
		NextAudioTrackID:       s.nextAudioTrackID,
		NextAudioClipID:        s.nextAudioClipID,
		NextExecutionID:        s.nextExecutionID,
		NextRunID:              s.nextRunID,
		NextImportBatchID:      s.nextImportBatchID,
		NextImportBatchItemID:  s.nextImportBatchItemID,
		NextUploadSessionID:    s.nextUploadSessionID,
		NextUploadFileID:       s.nextUploadFileID,
		NextAssetID:            s.nextAssetID,
		NextVariantID:          s.nextVariantID,
		NextCandidateID:        s.nextCandidateID,
		NextReviewID:           s.nextReviewID,
		NextBudgetID:           s.nextBudgetID,
		NextUsageID:            s.nextUsageID,
		NextBillingEventID:     s.nextBillingEventID,
		NextEvaluationRunID:    s.nextEvaluationRunID,
		NextWorkflowRunID:      s.nextWorkflowRunID,
		NextWorkflowStepID:     s.nextWorkflowStepID,
		NextJobID:              s.nextJobID,
		NextStateTransitionID:  s.nextStateTransitionID,
		NextGatewayRequestID:   s.nextGatewayRequestID,
		Organizations:          cloneMap(s.Organizations),
		Users:                  cloneMap(s.Users),
		Roles:                  cloneMap(s.Roles),
		Memberships:            cloneMap(s.Memberships),
		RolePermissions:        cloneStringSliceMap(s.RolePermissions),
		Projects:               cloneMap(s.Projects),
		Episodes:               cloneMap(s.Episodes),
		Scenes:                 cloneMap(s.Scenes),
		Shots:                  cloneMap(s.Shots),
		Snapshots:              cloneMap(s.Snapshots),
		CollaborationSessions:  cloneMap(s.CollaborationSessions),
		CollaborationPresences: cloneMap(s.CollaborationPresences),
		PreviewAssemblies:      cloneMap(s.PreviewAssemblies),
		PreviewAssemblyItems:   cloneMap(s.PreviewAssemblyItems),
		PreviewRuntimes:        clonePreviewRuntimeMap(s.PreviewRuntimes),
		AudioTimelines:         cloneMap(s.AudioTimelines),
		AudioTracks:            cloneMap(s.AudioTracks),
		AudioClips:             cloneMap(s.AudioClips),
		ShotExecutions:         cloneMap(s.ShotExecutions),
		ShotExecutionRuns:      cloneMap(s.ShotExecutionRuns),
		ImportBatches:          cloneMap(s.ImportBatches),
		ImportBatchItems:       cloneMap(s.ImportBatchItems),
		UploadSessions:         cloneMap(s.UploadSessions),
		UploadFiles:            cloneMap(s.UploadFiles),
		MediaAssets:            cloneMap(s.MediaAssets),
		MediaAssetVariants:     cloneMap(s.MediaAssetVariants),
		CandidateAssets:        cloneMap(s.CandidateAssets),
		Reviews:                cloneMap(s.Reviews),
		EvaluationRuns:         cloneMap(s.EvaluationRuns),
		Budgets:                cloneMap(s.Budgets),
		UsageRecords:           cloneMap(s.UsageRecords),
		BillingEvents:          cloneMap(s.BillingEvents),
		WorkflowRuns:           cloneMap(s.WorkflowRuns),
		WorkflowSteps:          cloneMap(s.WorkflowSteps),
		Jobs:                   cloneMap(s.Jobs),
		StateTransitions:       cloneMap(s.StateTransitions),
		GatewayResults:         cloneMap(s.GatewayResults),
	}
}

func (s *MemoryStore) applySnapshot(snapshot Snapshot) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextProjectID = snapshot.NextProjectID
	s.nextEpisodeID = snapshot.NextEpisodeID
	s.nextSceneID = snapshot.NextSceneID
	s.nextShotID = snapshot.NextShotID
	s.nextSnapshotID = snapshot.NextSnapshotID
	s.nextGroupID = snapshot.NextGroupID
	s.nextCollaborationID = snapshot.NextCollaborationID
	s.nextPresenceID = snapshot.NextPresenceID
	s.nextPreviewAssemblyID = snapshot.NextPreviewAssemblyID
	s.nextPreviewItemID = snapshot.NextPreviewItemID
	s.nextPreviewRuntimeID = snapshot.NextPreviewRuntimeID
	s.nextAudioTimelineID = snapshot.NextAudioTimelineID
	s.nextAudioTrackID = snapshot.NextAudioTrackID
	s.nextAudioClipID = snapshot.NextAudioClipID
	s.nextExecutionID = snapshot.NextExecutionID
	s.nextRunID = snapshot.NextRunID
	s.nextImportBatchID = snapshot.NextImportBatchID
	s.nextImportBatchItemID = snapshot.NextImportBatchItemID
	s.nextUploadSessionID = snapshot.NextUploadSessionID
	s.nextUploadFileID = snapshot.NextUploadFileID
	s.nextAssetID = snapshot.NextAssetID
	s.nextVariantID = snapshot.NextVariantID
	s.nextCandidateID = snapshot.NextCandidateID
	s.nextReviewID = snapshot.NextReviewID
	s.nextBudgetID = snapshot.NextBudgetID
	s.nextUsageID = snapshot.NextUsageID
	s.nextBillingEventID = snapshot.NextBillingEventID
	s.nextEvaluationRunID = snapshot.NextEvaluationRunID
	s.nextWorkflowRunID = snapshot.NextWorkflowRunID
	s.nextWorkflowStepID = snapshot.NextWorkflowStepID
	s.nextJobID = snapshot.NextJobID
	s.nextStateTransitionID = snapshot.NextStateTransitionID
	s.nextGatewayRequestID = snapshot.NextGatewayRequestID

	s.Organizations = cloneMap(snapshot.Organizations)
	s.Users = cloneMap(snapshot.Users)
	s.Roles = cloneMap(snapshot.Roles)
	s.Memberships = cloneMap(snapshot.Memberships)
	s.RolePermissions = cloneStringSliceMap(snapshot.RolePermissions)
	s.Projects = cloneMap(snapshot.Projects)
	s.Episodes = cloneMap(snapshot.Episodes)
	s.Scenes = cloneMap(snapshot.Scenes)
	s.Shots = cloneMap(snapshot.Shots)
	s.Snapshots = cloneMap(snapshot.Snapshots)
	s.CollaborationSessions = cloneMap(snapshot.CollaborationSessions)
	s.CollaborationPresences = cloneMap(snapshot.CollaborationPresences)
	s.PreviewAssemblies = cloneMap(snapshot.PreviewAssemblies)
	s.PreviewAssemblyItems = cloneMap(snapshot.PreviewAssemblyItems)
	s.PreviewRuntimes = clonePreviewRuntimeMap(snapshot.PreviewRuntimes)
	s.AudioTimelines = cloneMap(snapshot.AudioTimelines)
	s.AudioTracks = cloneMap(snapshot.AudioTracks)
	s.AudioClips = cloneMap(snapshot.AudioClips)
	s.ShotExecutions = cloneMap(snapshot.ShotExecutions)
	s.ShotExecutionRuns = cloneMap(snapshot.ShotExecutionRuns)
	s.ImportBatches = cloneMap(snapshot.ImportBatches)
	s.ImportBatchItems = cloneMap(snapshot.ImportBatchItems)
	s.UploadSessions = cloneMap(snapshot.UploadSessions)
	s.UploadFiles = cloneMap(snapshot.UploadFiles)
	s.MediaAssets = cloneMap(snapshot.MediaAssets)
	s.MediaAssetVariants = cloneMap(snapshot.MediaAssetVariants)
	s.CandidateAssets = cloneMap(snapshot.CandidateAssets)
	s.Reviews = cloneMap(snapshot.Reviews)
	s.EvaluationRuns = cloneMap(snapshot.EvaluationRuns)
	s.Budgets = cloneMap(snapshot.Budgets)
	s.UsageRecords = cloneMap(snapshot.UsageRecords)
	s.BillingEvents = cloneMap(snapshot.BillingEvents)
	s.WorkflowRuns = cloneMap(snapshot.WorkflowRuns)
	s.WorkflowSteps = cloneMap(snapshot.WorkflowSteps)
	s.Jobs = cloneMap(snapshot.Jobs)
	s.StateTransitions = cloneMap(snapshot.StateTransitions)
	s.GatewayResults = cloneMap(snapshot.GatewayResults)
}

func cloneMap[T any](input map[string]T) map[string]T {
	if len(input) == 0 {
		return make(map[string]T)
	}
	cloned := make(map[string]T, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func cloneStringSliceMap(input map[string][]string) map[string][]string {
	if len(input) == 0 {
		return make(map[string][]string)
	}
	cloned := make(map[string][]string, len(input))
	for key, value := range input {
		cloned[key] = append([]string(nil), value...)
	}
	return cloned
}

func (s *MemoryStore) NextProjectID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextProjectID++
	return fmt.Sprintf("project-%d", s.nextProjectID)
}

func (s *MemoryStore) NextEpisodeID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextEpisodeID++
	return fmt.Sprintf("episode-%d", s.nextEpisodeID)
}

func (s *MemoryStore) NextSceneID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextSceneID++
	return fmt.Sprintf("scene-%d", s.nextSceneID)
}

func (s *MemoryStore) NextShotID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextShotID++
	return fmt.Sprintf("shot-%d", s.nextShotID)
}

func (s *MemoryStore) NextSnapshotID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextSnapshotID++
	return fmt.Sprintf("snapshot-%d", s.nextSnapshotID)
}

func (s *MemoryStore) NextTranslationGroupID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextGroupID++
	return fmt.Sprintf("translation-group-%d", s.nextGroupID)
}

func (s *MemoryStore) NextCollaborationSessionID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextCollaborationID++
	return fmt.Sprintf("collaboration-session-%d", s.nextCollaborationID)
}

func (s *MemoryStore) NextCollaborationPresenceID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextPresenceID++
	return fmt.Sprintf("collaboration-presence-%d", s.nextPresenceID)
}

func (s *MemoryStore) NextPreviewAssemblyID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextPreviewAssemblyID++
	return fmt.Sprintf("preview-assembly-%d", s.nextPreviewAssemblyID)
}

func (s *MemoryStore) NextPreviewAssemblyItemID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextPreviewItemID++
	return fmt.Sprintf("preview-assembly-item-%d", s.nextPreviewItemID)
}

func (s *MemoryStore) NextPreviewRuntimeID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextPreviewRuntimeID++
	return fmt.Sprintf("preview-runtime-%d", s.nextPreviewRuntimeID)
}

func (s *MemoryStore) NextAudioTimelineID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextAudioTimelineID++
	return fmt.Sprintf("audio-timeline-%d", s.nextAudioTimelineID)
}

func (s *MemoryStore) NextAudioTrackID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextAudioTrackID++
	return fmt.Sprintf("audio-track-%d", s.nextAudioTrackID)
}

func (s *MemoryStore) NextAudioClipID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextAudioClipID++
	return fmt.Sprintf("audio-clip-%d", s.nextAudioClipID)
}

func (s *MemoryStore) NextShotExecutionID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextExecutionID++
	return fmt.Sprintf("shot-execution-%d", s.nextExecutionID)
}

func (s *MemoryStore) NextShotExecutionRunID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextRunID++
	return fmt.Sprintf("shot-execution-run-%d", s.nextRunID)
}

func (s *MemoryStore) NextImportBatchID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextImportBatchID++
	return fmt.Sprintf("import-batch-%d", s.nextImportBatchID)
}

func (s *MemoryStore) NextImportBatchItemID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextImportBatchItemID++
	return fmt.Sprintf("import-batch-item-%d", s.nextImportBatchItemID)
}

func (s *MemoryStore) NextUploadSessionID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextUploadSessionID++
	return fmt.Sprintf("upload-session-%d", s.nextUploadSessionID)
}

func (s *MemoryStore) NextUploadFileID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextUploadFileID++
	return fmt.Sprintf("upload-file-%d", s.nextUploadFileID)
}

func (s *MemoryStore) NextMediaAssetID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextAssetID++
	return fmt.Sprintf("media-asset-%d", s.nextAssetID)
}

func (s *MemoryStore) NextMediaAssetVariantID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextVariantID++
	return fmt.Sprintf("media-asset-variant-%d", s.nextVariantID)
}

func (s *MemoryStore) NextCandidateAssetID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextCandidateID++
	return fmt.Sprintf("candidate-asset-%d", s.nextCandidateID)
}

func (s *MemoryStore) NextReviewID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextReviewID++
	return fmt.Sprintf("shot-review-%d", s.nextReviewID)
}

func (s *MemoryStore) NextBudgetID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextBudgetID++
	return fmt.Sprintf("budget-%d", s.nextBudgetID)
}

func (s *MemoryStore) NextUsageRecordID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextUsageID++
	return fmt.Sprintf("usage-record-%d", s.nextUsageID)
}

func (s *MemoryStore) NextBillingEventID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextBillingEventID++
	return fmt.Sprintf("billing-event-%d", s.nextBillingEventID)
}

func (s *MemoryStore) NextEvaluationRunID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextEvaluationRunID++
	return fmt.Sprintf("evaluation-run-%d", s.nextEvaluationRunID)
}

func (s *MemoryStore) NextWorkflowRunID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextWorkflowRunID++
	return fmt.Sprintf("workflow-run-%d", s.nextWorkflowRunID)
}

func (s *MemoryStore) NextWorkflowStepID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextWorkflowStepID++
	return fmt.Sprintf("workflow-step-%d", s.nextWorkflowStepID)
}

func (s *MemoryStore) NextJobID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextJobID++
	return fmt.Sprintf("job-%d", s.nextJobID)
}

func (s *MemoryStore) NextStateTransitionID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextStateTransitionID++
	return fmt.Sprintf("state-transition-%d", s.nextStateTransitionID)
}

func (s *MemoryStore) NextGatewayExternalRequestID() string {
	if s.useUUIDIDs {
		return uuid.NewString()
	}
	s.nextGatewayRequestID++
	return fmt.Sprintf("external-request-%d", s.nextGatewayRequestID)
}
