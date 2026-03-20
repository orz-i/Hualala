package db

import (
	"fmt"
	"sync"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/review"
)

type Handle struct{}

func NewHandle() Handle {
	return Handle{}
}

type MemoryStore struct {
	mu sync.RWMutex

	nextProjectID         int
	nextEpisodeID         int
	nextSceneID           int
	nextShotID            int
	nextSnapshotID        int
	nextGroupID           int
	nextExecutionID       int
	nextRunID             int
	nextImportBatchID     int
	nextImportBatchItemID int
	nextAssetID           int
	nextCandidateID       int
	nextReviewID          int
	nextBudgetID          int
	nextUsageID           int
	nextBillingEventID    int
	nextEvaluationRunID   int

	Projects          map[string]project.Project
	Episodes          map[string]project.Episode
	Scenes            map[string]content.Scene
	Shots             map[string]content.Shot
	Snapshots         map[string]content.Snapshot
	ShotExecutions    map[string]execution.ShotExecution
	ShotExecutionRuns map[string]execution.ShotExecutionRun
	ImportBatches     map[string]asset.ImportBatch
	ImportBatchItems  map[string]asset.ImportBatchItem
	MediaAssets       map[string]asset.MediaAsset
	CandidateAssets   map[string]asset.CandidateAsset
	Reviews           map[string]review.ShotReview
	EvaluationRuns    map[string]review.EvaluationRun
	Budgets           map[string]billing.ProjectBudget
	UsageRecords      map[string]billing.UsageRecord
	BillingEvents     map[string]billing.BillingEvent
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		Projects:          make(map[string]project.Project),
		Episodes:          make(map[string]project.Episode),
		Scenes:            make(map[string]content.Scene),
		Shots:             make(map[string]content.Shot),
		Snapshots:         make(map[string]content.Snapshot),
		ShotExecutions:    make(map[string]execution.ShotExecution),
		ShotExecutionRuns: make(map[string]execution.ShotExecutionRun),
		ImportBatches:     make(map[string]asset.ImportBatch),
		ImportBatchItems:  make(map[string]asset.ImportBatchItem),
		MediaAssets:       make(map[string]asset.MediaAsset),
		CandidateAssets:   make(map[string]asset.CandidateAsset),
		Reviews:           make(map[string]review.ShotReview),
		EvaluationRuns:    make(map[string]review.EvaluationRun),
		Budgets:           make(map[string]billing.ProjectBudget),
		UsageRecords:      make(map[string]billing.UsageRecord),
		BillingEvents:     make(map[string]billing.BillingEvent),
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

func (s *MemoryStore) NextShotExecutionID() string {
	s.nextExecutionID++
	return fmt.Sprintf("shot-execution-%d", s.nextExecutionID)
}

func (s *MemoryStore) NextShotExecutionRunID() string {
	s.nextRunID++
	return fmt.Sprintf("shot-execution-run-%d", s.nextRunID)
}

func (s *MemoryStore) NextImportBatchID() string {
	s.nextImportBatchID++
	return fmt.Sprintf("import-batch-%d", s.nextImportBatchID)
}

func (s *MemoryStore) NextImportBatchItemID() string {
	s.nextImportBatchItemID++
	return fmt.Sprintf("import-batch-item-%d", s.nextImportBatchItemID)
}

func (s *MemoryStore) NextMediaAssetID() string {
	s.nextAssetID++
	return fmt.Sprintf("media-asset-%d", s.nextAssetID)
}

func (s *MemoryStore) NextCandidateAssetID() string {
	s.nextCandidateID++
	return fmt.Sprintf("candidate-asset-%d", s.nextCandidateID)
}

func (s *MemoryStore) NextReviewID() string {
	s.nextReviewID++
	return fmt.Sprintf("shot-review-%d", s.nextReviewID)
}

func (s *MemoryStore) NextBudgetID() string {
	s.nextBudgetID++
	return fmt.Sprintf("budget-%d", s.nextBudgetID)
}

func (s *MemoryStore) NextUsageRecordID() string {
	s.nextUsageID++
	return fmt.Sprintf("usage-record-%d", s.nextUsageID)
}

func (s *MemoryStore) NextBillingEventID() string {
	s.nextBillingEventID++
	return fmt.Sprintf("billing-event-%d", s.nextBillingEventID)
}

func (s *MemoryStore) NextEvaluationRunID() string {
	s.nextEvaluationRunID++
	return fmt.Sprintf("evaluation-run-%d", s.nextEvaluationRunID)
}
