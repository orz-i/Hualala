package executionapp

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
}

type StartShotExecutionRunInput struct {
	ShotID             string
	OperatorID         string
	ProjectID          string
	OrgID              string
	TriggerType        string
	EstimatedCostCents int64
}

type GetShotExecutionInput struct {
	ShotExecutionID string
}

type SelectPrimaryAssetInput struct {
	ShotExecutionID string
	AssetID         string
}

type RunSubmissionGateChecksInput struct {
	ShotExecutionID string
}

type SubmitShotForReviewInput struct {
	ShotExecutionID string
}

type MarkShotReworkRequiredInput struct {
	ShotExecutionID string
	Reason          string
}

type MarkShotApprovedForUseInput struct {
	ShotExecutionID string
}

type ListShotExecutionRunsInput struct {
	ShotExecutionID string
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

	return run, nil
}

func (s *Service) GetShotExecution(_ context.Context, input GetShotExecutionInput) (execution.ShotExecution, error) {
	record, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	return record, nil
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
