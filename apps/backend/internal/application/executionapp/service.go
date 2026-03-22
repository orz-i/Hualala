package executionapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	executions     db.ExecutionRepository
	projectContent db.ProjectContentRepository
	assets         db.AssetRepository
	reviewBilling  db.ReviewBillingRepository
	eventPublisher *events.Publisher
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

func NewService(executions db.ExecutionRepository, projectContent db.ProjectContentRepository, assets db.AssetRepository, reviewBilling db.ReviewBillingRepository, eventPublisher *events.Publisher) *Service {
	return &Service{
		executions:     executions,
		projectContent: projectContent,
		assets:         assets,
		reviewBilling:  reviewBilling,
		eventPublisher: eventPublisher,
	}
}

func (s *Service) StartShotExecutionRun(ctx context.Context, input StartShotExecutionRunInput) (execution.ShotExecutionRun, error) {
	if s == nil || s.executions == nil || s.reviewBilling == nil {
		return execution.ShotExecutionRun{}, errors.New("executionapp: repositories are required")
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
			ID:        s.executions.GenerateShotExecutionID(),
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
	for _, run := range s.executions.ListShotExecutionRuns(shotExecution.ID) {
		if run.RunNumber >= runNumber {
			runNumber = run.RunNumber + 1
		}
	}

	run := execution.ShotExecutionRun{
		ID:              s.executions.GenerateShotExecutionRunID(),
		ShotExecutionID: shotExecution.ID,
		RunNumber:       runNumber,
		Status:          "running",
		TriggerType:     strings.TrimSpace(input.TriggerType),
		OperatorID:      strings.TrimSpace(input.OperatorID),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if input.EstimatedCostCents > 0 {
		if err := s.ensureBudgetReservationAllowed(shotExecution.ProjectID, input.EstimatedCostCents); err != nil {
			return execution.ShotExecutionRun{}, err
		}
	}
	if !found {
		if err := s.executions.SaveShotExecution(ctx, shotExecution); err != nil {
			return execution.ShotExecutionRun{}, err
		}
	}
	if err := s.executions.SaveShotExecutionRun(ctx, run); err != nil {
		return execution.ShotExecutionRun{}, err
	}
	shotExecution.CurrentRunID = run.ID
	if err := s.executions.SaveShotExecution(ctx, shotExecution); err != nil {
		return execution.ShotExecutionRun{}, err
	}
	if input.EstimatedCostCents > 0 {
		if err := s.reserveBudgetForRun(ctx, shotExecution, run, input.EstimatedCostCents, now); err != nil {
			return execution.ShotExecutionRun{}, err
		}
	}
	s.publishShotExecutionUpdated(ctx, shotExecution, map[string]any{
		"shot_execution_id": shotExecution.ID,
		"shot_id":           shotExecution.ShotID,
		"status":            shotExecution.Status,
		"current_run_id":    shotExecution.CurrentRunID,
		"trigger_type":      run.TriggerType,
	})

	return run, nil
}

func (s *Service) GetShotExecution(_ context.Context, input GetShotExecutionInput) (execution.ShotExecution, error) {
	if s == nil || s.executions == nil {
		return execution.ShotExecution{}, errors.New("executionapp: repository is required")
	}
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
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

func (s *Service) SelectPrimaryAsset(ctx context.Context, input SelectPrimaryAssetInput) (execution.ShotExecution, error) {
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	if _, ok := s.assets.GetMediaAsset(input.AssetID); !ok {
		return execution.ShotExecution{}, errors.New("executionapp: asset not found")
	}

	record.PrimaryAssetID = input.AssetID
	record.Status = "primary_selected"
	record.UpdatedAt = time.Now().UTC()
	if err := s.executions.SaveShotExecution(ctx, record); err != nil {
		return execution.ShotExecution{}, err
	}
	s.publishShotExecutionUpdated(ctx, record, map[string]any{
		"shot_execution_id": record.ID,
		"shot_id":           record.ShotID,
		"status":            record.Status,
		"primary_asset_id":  record.PrimaryAssetID,
	})
	return record, nil
}

func (s *Service) RunSubmissionGateChecks(_ context.Context, input RunSubmissionGateChecksInput) (execution.SubmissionGateResult, error) {
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return execution.SubmissionGateResult{}, errors.New("executionapp: shot execution not found")
	}

	hasCandidate := len(s.assets.ListCandidateAssetsByExecution(record.ID)) > 0

	result := execution.SubmissionGateResult{}
	s.appendCheck(&result, "candidate_assets_present", hasCandidate)

	shot, hasShot := s.projectContent.GetShot(record.ShotID)
	s.appendCheck(&result, "structure_complete", hasShot && strings.TrimSpace(shot.Title) != "" && strings.TrimSpace(shot.SceneID) != "")
	s.appendCheck(&result, "content_consistent", s.hasShotSnapshot(record.ShotID))
	s.appendCheck(&result, "primary_asset_selected", strings.TrimSpace(record.PrimaryAssetID) != "")

	projectRecord, hasProject := s.projectContent.GetProject(record.ProjectID)
	primaryAsset, hasPrimaryAsset := s.assets.GetMediaAsset(record.PrimaryAssetID)
	s.appendCheck(&result, "source_traceable", hasPrimaryAsset && strings.TrimSpace(primaryAsset.ImportBatchID) != "")
	s.appendCheck(&result, "rights_cleared", hasPrimaryAsset && primaryAsset.RightsStatus == "clear")
	s.appendCheck(&result, "ai_labeled", hasPrimaryAsset && primaryAsset.AIAnnotated)
	s.appendCheck(&result, "budget_available", s.hasAvailableBudget(record.ProjectID))
	s.appendCheck(&result, "language_consistent", hasProject && hasPrimaryAsset && s.isSupportedLocale(projectRecord.SupportedContentLocales, primaryAsset.Locale))

	return result, nil
}

func (s *Service) SubmitShotForReview(ctx context.Context, input SubmitShotForReviewInput) (execution.ShotExecution, error) {
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
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
	if err := s.executions.SaveShotExecution(ctx, record); err != nil {
		return execution.ShotExecution{}, err
	}
	s.publishShotExecutionUpdated(ctx, record, map[string]any{
		"shot_execution_id": record.ID,
		"shot_id":           record.ShotID,
		"status":            record.Status,
		"primary_asset_id":  record.PrimaryAssetID,
	})
	return record, nil
}

func (s *Service) MarkShotReworkRequired(ctx context.Context, input MarkShotReworkRequiredInput) (execution.ShotExecution, error) {
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	record.Status = "rework_required"
	record.UpdatedAt = time.Now().UTC()
	if err := s.executions.SaveShotExecution(ctx, record); err != nil {
		return execution.ShotExecution{}, err
	}
	s.publishShotExecutionUpdated(ctx, record, map[string]any{
		"shot_execution_id": record.ID,
		"shot_id":           record.ShotID,
		"status":            record.Status,
		"current_run_id":    record.CurrentRunID,
		"reason":            strings.TrimSpace(input.Reason),
	})
	return record, nil
}

func (s *Service) MarkShotApprovedForUse(ctx context.Context, input MarkShotApprovedForUseInput) (execution.ShotExecution, error) {
	record, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return execution.ShotExecution{}, errors.New("executionapp: shot execution not found")
	}
	record.Status = "approved_for_use"
	record.UpdatedAt = time.Now().UTC()
	if err := s.executions.SaveShotExecution(ctx, record); err != nil {
		return execution.ShotExecution{}, err
	}
	return record, nil
}

func (s *Service) ListShotExecutionRuns(_ context.Context, input ListShotExecutionRunsInput) ([]execution.ShotExecutionRun, error) {
	if s == nil || s.executions == nil {
		return nil, errors.New("executionapp: repository is required")
	}
	return s.executions.ListShotExecutionRuns(input.ShotExecutionID), nil
}

func (s *Service) findExecutionByShotID(shotID string) (execution.ShotExecution, bool) {
	return s.executions.FindShotExecutionByShotID(shotID)
}

func (s *Service) listCandidateAssets(shotExecutionID string) []asset.CandidateAsset {
	return s.assets.ListCandidateAssetsByExecution(shotExecutionID)
}

func (s *Service) buildShotReviewSummary(shotExecutionID string) ShotReviewSummary {
	reviews := s.reviewBilling.ListReviewsByExecution(shotExecutionID)
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
	runs := s.reviewBilling.ListEvaluationRunsByExecution(shotExecutionID)
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
	for _, snapshot := range s.projectContent.ListSnapshotsByOwner("shot", shotID) {
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
	if record, ok := s.reviewBilling.GetBudgetByProject(projectID); ok {
		return record.ReservedCents <= record.LimitCents
	}
	return true
}

func (s *Service) ensureBudgetReservationAllowed(projectID string, amountCents int64) error {
	budgetRecord, ok := s.reviewBilling.GetBudgetByProject(projectID)
	if !ok {
		return nil
	}
	if budgetRecord.ReservedCents+amountCents > budgetRecord.LimitCents {
		return fmt.Errorf("executionapp: budget exceeded for project %s", projectID)
	}
	return nil
}

func (s *Service) reserveBudgetForRun(ctx context.Context, shotExecution execution.ShotExecution, run execution.ShotExecutionRun, amountCents int64, now time.Time) error {
	budgetRecord, ok := s.reviewBilling.GetBudgetByProject(shotExecution.ProjectID)
	if !ok {
		return nil
	}

	budgetRecord.ReservedCents += amountCents
	budgetRecord.UpdatedAt = now
	if err := s.reviewBilling.SaveBudget(ctx, budgetRecord); err != nil {
		return err
	}

	usageRecord := billing.UsageRecord{
		ID:                 s.reviewBilling.GenerateUsageRecordID(),
		OrgID:              shotExecution.OrgID,
		ProjectID:          shotExecution.ProjectID,
		ShotExecutionID:    shotExecution.ID,
		ShotExecutionRunID: run.ID,
		Meter:              "shot_execution_run",
		AmountCents:        amountCents,
		CreatedAt:          now,
	}
	if err := s.reviewBilling.SaveUsageRecord(ctx, usageRecord); err != nil {
		return err
	}

	billingEvent := billing.BillingEvent{
		ID:                 s.reviewBilling.GenerateBillingEventID(),
		OrgID:              shotExecution.OrgID,
		ProjectID:          shotExecution.ProjectID,
		ShotExecutionID:    shotExecution.ID,
		ShotExecutionRunID: run.ID,
		EventType:          "execution_reserved",
		AmountCents:        amountCents,
		CreatedAt:          now,
	}
	return s.reviewBilling.SaveBillingEvent(ctx, billingEvent)
}

func (s *Service) publishShotExecutionUpdated(ctx context.Context, record execution.ShotExecution, payload map[string]any) {
	if s == nil || s.eventPublisher == nil {
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	s.eventPublisher.PublishWithContext(ctx, events.Event{
		EventType:      "shot.execution.updated",
		OrganizationID: record.OrgID,
		ProjectID:      record.ProjectID,
		ResourceType:   "shot_execution",
		ResourceID:     record.ID,
		Payload:        string(body),
	})
}
