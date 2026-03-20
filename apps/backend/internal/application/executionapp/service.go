package executionapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	store *db.MemoryStore
}

type StartShotExecutionRunInput struct {
	ShotID             string `json:"shot_id"`
	OperatorID         string `json:"operator_id"`
	ProjectID          string `json:"project_id"`
	OrgID              string `json:"org_id"`
	TriggerType        string `json:"trigger_type"`
	EstimatedCostCents int64  `json:"estimated_cost_cents"`
}

type GetShotExecutionInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
}

type GetShotWorkbenchInput struct {
	ShotID string
}

type SelectPrimaryAssetInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
	AssetID         string `json:"asset_id"`
}

type RunSubmissionGateChecksInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
}

type SubmitShotForReviewInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
}

type MarkShotReworkRequiredInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
	Reason          string `json:"reason"`
}

type MarkShotApprovedForUseInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
}

type ListShotExecutionRunsInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
}

type ShotWorkbench struct {
	ShotExecution       execution.ShotExecution
	Runs                []execution.ShotExecutionRun
	CandidateAssets     []asset.CandidateAsset
	ReviewSummary       ShotReviewSummary
	LatestEvaluationRun *review.EvaluationRun
}

type ShotReviewSummary struct {
	ShotExecutionID  string
	LatestConclusion string
	LatestReviewID   string
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) StartShotExecutionRun(_ context.Context, input StartShotExecutionRunInput) (execution.ShotExecutionRun, error) {
	if s == nil || s.store == nil {
		return execution.ShotExecutionRun{}, errors.New("executionapp: store is required")
	}
	if strings.TrimSpace(input.ShotID) == "" {
		return execution.ShotExecutionRun{}, errors.New("executionapp: shot_id is required")
	}
	if strings.TrimSpace(input.ProjectID) == "" {
		return execution.ShotExecutionRun{}, errors.New("executionapp: project_id is required")
	}
	if strings.TrimSpace(input.OrgID) == "" {
		return execution.ShotExecutionRun{}, errors.New("executionapp: org_id is required")
	}

	now := time.Now().UTC()
	shotExecution, found := s.findExecutionByShotID(input.ShotID)
	if !found {
		shotExecution = execution.ShotExecution{
			ID:        s.store.NextShotExecutionID(),
			OrgID:     strings.TrimSpace(input.OrgID),
			ProjectID: strings.TrimSpace(input.ProjectID),
			ShotID:    strings.TrimSpace(input.ShotID),
			Status:    "in_progress",
			CreatedAt: now,
			UpdatedAt: now,
		}
	} else {
		shotExecution.Status = "in_progress"
		shotExecution.UpdatedAt = now
	}

	runNumber := 1
	for _, run := range s.store.ShotExecutionRuns {
		if run.ShotExecutionID == shotExecution.ID && run.RunNumber >= runNumber {
			runNumber = run.RunNumber + 1
		}
	}

	run := execution.ShotExecutionRun{
		ID:              s.store.NextShotExecutionRunID(),
		ShotExecutionID: shotExecution.ID,
		RunNumber:       runNumber,
		Status:          "running",
		TriggerType:     strings.TrimSpace(input.TriggerType),
		OperatorID:      strings.TrimSpace(input.OperatorID),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	shotExecution.CurrentRunID = run.ID
	s.store.ShotExecutions[shotExecution.ID] = shotExecution
	s.store.ShotExecutionRuns[run.ID] = run
	if input.EstimatedCostCents > 0 {
		if err := s.reserveBudgetForRun(shotExecution, run, input.EstimatedCostCents, now); err != nil {
			return execution.ShotExecutionRun{}, err
		}
	}
	s.publishShotExecutionUpdated(shotExecution, map[string]any{
		"shot_execution_id": shotExecution.ID,
		"shot_id":           shotExecution.ShotID,
		"status":            shotExecution.Status,
		"current_run_id":    shotExecution.CurrentRunID,
		"trigger_type":      run.TriggerType,
	})

	return run, nil
}

func (s *Service) GetShotExecution(_ context.Context, input GetShotExecutionInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	return record, nil
}

func (s *Service) GetShotWorkbench(ctx context.Context, input GetShotWorkbenchInput) (ShotWorkbench, error) {
	record, ok := s.findExecutionByShotID(input.ShotID)
	if !ok {
		return ShotWorkbench{}, errors.New("executionapp: shot execution not found")
	}

	runs, err := s.ListShotExecutionRuns(ctx, ListShotExecutionRunsInput{
		ShotExecutionID: record.ID,
	})
	if err != nil {
		return ShotWorkbench{}, err
	}

	return ShotWorkbench{
		ShotExecution:       record,
		Runs:                runs,
		CandidateAssets:     s.listCandidateAssets(record.ID),
		ReviewSummary:       s.buildShotReviewSummary(record.ID),
		LatestEvaluationRun: s.findLatestEvaluationRun(record.ID),
	}, nil
}

func (s *Service) SelectPrimaryAsset(_ context.Context, input SelectPrimaryAssetInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	if _, ok := s.store.MediaAssets[input.AssetID]; !ok {
		return execution.ShotExecution{}, errors.New("executionapp: asset not found")
	}

	record.PrimaryAssetID = input.AssetID
	record.Status = "primary_selected"
	record.UpdatedAt = time.Now().UTC()
	s.store.ShotExecutions[record.ID] = record
	s.publishShotExecutionUpdated(record, map[string]any{
		"shot_execution_id": record.ID,
		"shot_id":           record.ShotID,
		"status":            record.Status,
		"primary_asset_id":  record.PrimaryAssetID,
	})
	return record, nil
}

func (s *Service) RunSubmissionGateChecks(_ context.Context, input RunSubmissionGateChecksInput) (execution.SubmissionGateResult, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.SubmissionGateResult{}, errors.New("executionapp: shot execution not found")
	}

	hasCandidate := false
	for _, candidate := range s.store.CandidateAssets {
		if candidate.ShotExecutionID == record.ID {
			hasCandidate = true
			break
		}
	}

	result := execution.SubmissionGateResult{}
	s.appendCheck(&result, "candidate_assets_present", hasCandidate)

	shot, hasShot := s.store.Shots[record.ShotID]
	s.appendCheck(&result, "structure_complete", hasShot && strings.TrimSpace(shot.Title) != "" && strings.TrimSpace(shot.SceneID) != "")
	s.appendCheck(&result, "content_consistent", s.hasShotSnapshot(record.ShotID))
	s.appendCheck(&result, "primary_asset_selected", strings.TrimSpace(record.PrimaryAssetID) != "")

	project, hasProject := s.store.Projects[record.ProjectID]
	primaryAsset, hasPrimaryAsset := s.store.MediaAssets[record.PrimaryAssetID]
	s.appendCheck(&result, "source_traceable", hasPrimaryAsset && strings.TrimSpace(primaryAsset.ImportBatchID) != "")
	s.appendCheck(&result, "rights_cleared", hasPrimaryAsset && primaryAsset.RightsStatus == "clear")
	s.appendCheck(&result, "ai_labeled", hasPrimaryAsset && primaryAsset.AIAnnotated)
	s.appendCheck(&result, "budget_available", s.hasAvailableBudget(record.ProjectID))
	s.appendCheck(&result, "language_consistent", hasProject && hasPrimaryAsset && s.isSupportedLocale(project.SupportedContentLocales, primaryAsset.Locale))

	return result, nil
}

func (s *Service) SubmitShotForReview(_ context.Context, input SubmitShotForReviewInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	gate, err := s.RunSubmissionGateChecks(context.Background(), RunSubmissionGateChecksInput{
		ShotExecutionID: input.ShotExecutionID,
	})
	if err != nil {
		return execution.ShotExecution{}, err
	}
	if len(gate.FailedChecks) > 0 {
		return execution.ShotExecution{}, fmt.Errorf("executionapp: submission gate failed: %s", strings.Join(gate.FailedChecks, ", "))
	}
	record.Status = "submitted_for_review"
	record.UpdatedAt = time.Now().UTC()
	s.store.ShotExecutions[record.ID] = record
	s.publishShotExecutionUpdated(record, map[string]any{
		"shot_execution_id": record.ID,
		"shot_id":           record.ShotID,
		"status":            record.Status,
		"primary_asset_id":  record.PrimaryAssetID,
	})
	return record, nil
}

func (s *Service) MarkShotReworkRequired(_ context.Context, input MarkShotReworkRequiredInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	record.Status = "rework_required"
	record.UpdatedAt = time.Now().UTC()
	s.store.ShotExecutions[record.ID] = record
	return record, nil
}

func (s *Service) MarkShotApprovedForUse(_ context.Context, input MarkShotApprovedForUseInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	record.Status = "approved_for_use"
	record.UpdatedAt = time.Now().UTC()
	s.store.ShotExecutions[record.ID] = record
	return record, nil
}

func (s *Service) ListShotExecutionRuns(_ context.Context, input ListShotExecutionRunsInput) ([]execution.ShotExecutionRun, error) {
	runs := make([]execution.ShotExecutionRun, 0)
	for _, run := range s.store.ShotExecutionRuns {
		if run.ShotExecutionID == input.ShotExecutionID {
			runs = append(runs, run)
		}
	}
	sort.Slice(runs, func(i, j int) bool {
		if runs[i].RunNumber == runs[j].RunNumber {
			return runs[i].ID < runs[j].ID
		}
		return runs[i].RunNumber < runs[j].RunNumber
	})
	return runs, nil
}

func (s *Service) findExecutionByShotID(shotID string) (execution.ShotExecution, bool) {
	for _, shotExecution := range s.store.ShotExecutions {
		if shotExecution.ShotID == shotID {
			return shotExecution, true
		}
	}
	return execution.ShotExecution{}, false
}

func (s *Service) listCandidateAssets(shotExecutionID string) []asset.CandidateAsset {
	candidates := make([]asset.CandidateAsset, 0)
	for _, candidate := range s.store.CandidateAssets {
		if candidate.ShotExecutionID == shotExecutionID {
			candidates = append(candidates, candidate)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].ID < candidates[j].ID
	})
	return candidates
}

func (s *Service) buildShotReviewSummary(shotExecutionID string) ShotReviewSummary {
	reviews := make([]review.ShotReview, 0)
	for _, record := range s.store.Reviews {
		if record.ShotExecutionID == shotExecutionID {
			reviews = append(reviews, record)
		}
	}
	sort.Slice(reviews, func(i, j int) bool {
		return reviews[i].ID < reviews[j].ID
	})
	if len(reviews) == 0 {
		return ShotReviewSummary{ShotExecutionID: shotExecutionID}
	}
	lastReview := reviews[len(reviews)-1]
	return ShotReviewSummary{
		ShotExecutionID:  shotExecutionID,
		LatestConclusion: lastReview.Conclusion,
		LatestReviewID:   lastReview.ID,
	}
}

func (s *Service) findLatestEvaluationRun(shotExecutionID string) *review.EvaluationRun {
	runs := make([]review.EvaluationRun, 0)
	for _, run := range s.store.EvaluationRuns {
		if run.ShotExecutionID == shotExecutionID {
			runs = append(runs, run)
		}
	}
	sort.Slice(runs, func(i, j int) bool {
		return runs[i].ID < runs[j].ID
	})
	if len(runs) == 0 {
		return nil
	}
	latest := runs[len(runs)-1]
	return &latest
}

func (s *Service) appendCheck(result *execution.SubmissionGateResult, check string, passed bool) {
	if passed {
		result.PassedChecks = append(result.PassedChecks, check)
		return
	}
	result.FailedChecks = append(result.FailedChecks, check)
}

func (s *Service) hasShotSnapshot(shotID string) bool {
	for _, snapshot := range s.store.Snapshots {
		if snapshot.OwnerType == "shot" && snapshot.OwnerID == shotID && strings.TrimSpace(snapshot.Body) != "" {
			return true
		}
	}
	return false
}

func (s *Service) isSupportedLocale(supported []string, target string) bool {
	target = strings.TrimSpace(target)
	if target == "" {
		return false
	}
	for _, locale := range supported {
		if locale == target {
			return true
		}
	}
	return false
}

func (s *Service) hasAvailableBudget(projectID string) bool {
	for _, record := range s.store.Budgets {
		if record.ProjectID == projectID {
			return record.ReservedCents <= record.LimitCents
		}
	}
	return true
}

func (s *Service) reserveBudgetForRun(shotExecution execution.ShotExecution, run execution.ShotExecutionRun, amountCents int64, now time.Time) error {
	for id, budgetRecord := range s.store.Budgets {
		if budgetRecord.ProjectID != shotExecution.ProjectID {
			continue
		}
		if budgetRecord.ReservedCents+amountCents > budgetRecord.LimitCents {
			return fmt.Errorf("executionapp: budget exceeded for project %s", shotExecution.ProjectID)
		}

		budgetRecord.ReservedCents += amountCents
		budgetRecord.UpdatedAt = now
		s.store.Budgets[id] = budgetRecord

		usageRecord := billing.UsageRecord{
			ID:                 s.store.NextUsageRecordID(),
			OrgID:              shotExecution.OrgID,
			ProjectID:          shotExecution.ProjectID,
			ShotExecutionID:    shotExecution.ID,
			ShotExecutionRunID: run.ID,
			Meter:              "shot_execution_run",
			AmountCents:        amountCents,
			CreatedAt:          now,
		}
		s.store.UsageRecords[usageRecord.ID] = usageRecord

		billingEvent := billing.BillingEvent{
			ID:                 s.store.NextBillingEventID(),
			OrgID:              shotExecution.OrgID,
			ProjectID:          shotExecution.ProjectID,
			ShotExecutionID:    shotExecution.ID,
			ShotExecutionRunID: run.ID,
			EventType:          "execution_reserved",
			AmountCents:        amountCents,
			CreatedAt:          now,
		}
		s.store.BillingEvents[billingEvent.ID] = billingEvent
		return nil
	}
	return nil
}

func (s *Service) publishShotExecutionUpdated(record execution.ShotExecution, payload map[string]any) {
	if s == nil || s.store == nil || s.store.EventPublisher == nil {
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	s.store.EventPublisher.Publish(events.Event{
		EventType:      "shot.execution.updated",
		OrganizationID: record.OrgID,
		ProjectID:      record.ProjectID,
		ResourceType:   "shot_execution",
		ResourceID:     record.ID,
		Payload:        string(body),
	})
}
