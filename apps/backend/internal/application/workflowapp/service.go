package workflowapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

type budgetGuard interface {
	EvaluateBudgetGuard(projectID string, estimatedCostCents int64) error
	EvaluateWorkflowRecoveryAllowed(run workflow.WorkflowRun) error
	EvaluateWorkflowCancellationAllowed(run workflow.WorkflowRun) error
}

type Service struct {
	repo      db.WorkflowRepository
	publisher *events.Publisher
	executor  temporal.Executor
	policy    budgetGuard
}

type StartWorkflowInput struct {
	OrganizationID     string
	ProjectID          string
	WorkflowType       string
	ResourceID         string
	Provider           string
	IdempotencyKey     string
	EstimatedCostCents int64
}

type GetWorkflowRunInput struct {
	WorkflowRunID string
}

type ListWorkflowStepsInput struct {
	WorkflowRunID string
}

type ListWorkflowRunsInput struct {
	ProjectID    string
	ResourceID   string
	Status       string
	WorkflowType string
}

type CancelWorkflowRunInput struct {
	WorkflowRunID string
}

type RetryWorkflowRunInput struct {
	WorkflowRunID string
}

type workflowJobPayload struct {
	WorkflowRunID string `json:"workflow_run_id"`
	AttemptCount  int    `json:"attempt_count"`
}

var defaultProviderByWorkflowType = map[string]string{
	"asset.import":  "seedance",
	"shot_pipeline": "seedance",
}

func NewService(repo db.WorkflowRepository, publisher *events.Publisher, executor temporal.Executor, policy budgetGuard) *Service {
	return &Service{
		repo:      repo,
		publisher: publisher,
		executor:  executor,
		policy:    policy,
	}
}

func (s *Service) StartWorkflow(ctx context.Context, input StartWorkflowInput) (workflow.WorkflowRun, error) {
	if s == nil || s.repo == nil {
		return workflow.WorkflowRun{}, errors.New("workflowapp: repository is required")
	}
	if strings.TrimSpace(input.WorkflowType) == "" {
		return workflow.WorkflowRun{}, errors.New("workflowapp: workflow_type is required")
	}
	if strings.TrimSpace(input.ResourceID) == "" {
		return workflow.WorkflowRun{}, errors.New("workflowapp: resource_id is required")
	}
	resolvedProvider, err := resolveProvider(input.WorkflowType, input.Provider)
	if err != nil {
		return workflow.WorkflowRun{}, err
	}
	if s.policy != nil {
		if err := s.policy.EvaluateBudgetGuard(input.ProjectID, input.EstimatedCostCents); err != nil {
			return workflow.WorkflowRun{}, err
		}
	}

	now := time.Now().UTC()
	run := workflow.WorkflowRun{
		ID:             s.repo.GenerateWorkflowRunID(),
		OrgID:          strings.TrimSpace(input.OrganizationID),
		ProjectID:      strings.TrimSpace(input.ProjectID),
		WorkflowType:   strings.TrimSpace(input.WorkflowType),
		ResourceID:     strings.TrimSpace(input.ResourceID),
		Status:         workflow.StatusPending,
		CurrentStep:    attemptStepKey(1, "dispatch"),
		AttemptCount:   1,
		Provider:       resolvedProvider,
		IdempotencyKey: normalizeIdempotencyKey(input),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.saveWorkflowRunState(ctx, run, "", "queued"); err != nil {
		return workflow.WorkflowRun{}, err
	}
	if _, err := s.createAttemptStep(ctx, run, "dispatch", workflow.StatusCompleted); err != nil {
		return workflow.WorkflowRun{}, err
	}
	if err := s.enqueueWorkflowJob(ctx, run); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(ctx, run)
	return run, nil
}

func (s *Service) GetWorkflowRun(_ context.Context, input GetWorkflowRunInput) (workflow.WorkflowRun, error) {
	record, ok := s.repo.GetWorkflowRun(strings.TrimSpace(input.WorkflowRunID))
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	return record, nil
}

func (s *Service) ListWorkflowSteps(_ context.Context, input ListWorkflowStepsInput) ([]workflow.WorkflowStep, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("workflowapp: repository is required")
	}
	return s.repo.ListWorkflowSteps(strings.TrimSpace(input.WorkflowRunID)), nil
}

func (s *Service) ListWorkflowRuns(_ context.Context, input ListWorkflowRunsInput) ([]workflow.WorkflowRun, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("workflowapp: repository is required")
	}
	return s.repo.ListWorkflowRuns(
		strings.TrimSpace(input.ProjectID),
		strings.TrimSpace(input.ResourceID),
		strings.TrimSpace(input.Status),
		strings.TrimSpace(input.WorkflowType),
	), nil
}

func (s *Service) CancelWorkflowRun(ctx context.Context, input CancelWorkflowRunInput) (workflow.WorkflowRun, error) {
	if s == nil || s.repo == nil {
		return workflow.WorkflowRun{}, errors.New("workflowapp: repository is required")
	}
	record, ok := s.repo.GetWorkflowRun(strings.TrimSpace(input.WorkflowRunID))
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	if s.policy != nil {
		if err := s.policy.EvaluateWorkflowCancellationAllowed(record); err != nil {
			return workflow.WorkflowRun{}, err
		}
	}

	now := time.Now().UTC()
	for _, job := range s.repo.ListJobs(workflow.ResourceTypeWorkflowRun, record.ID, workflow.JobTypeWorkflowDispatch, "") {
		if job.Status != workflow.StatusPending && job.Status != workflow.StatusRunning {
			continue
		}
		job.Status = workflow.StatusCancelled
		job.ErrorCode = ""
		job.ErrorMessage = ""
		job.UpdatedAt = now
		if err := s.repo.SaveJob(ctx, job); err != nil {
			return workflow.WorkflowRun{}, err
		}
	}
	if err := s.cancelAttemptGatewayStep(ctx, record, now); err != nil {
		return workflow.WorkflowRun{}, err
	}

	cancelKey := attemptStepKey(record.AttemptCount, "cancel")
	cancelStep, ok := s.findWorkflowStep(record.ID, cancelKey)
	if !ok {
		var err error
		cancelStep, err = s.createAttemptStep(ctx, record, "cancel", workflow.StatusCompleted)
		if err != nil {
			return workflow.WorkflowRun{}, err
		}
	}

	previousStatus := record.Status
	record.Status = workflow.StatusCancelled
	record.CurrentStep = cancelStep.StepKey
	record.LastError = ""
	record.UpdatedAt = now
	if err := s.saveWorkflowRunState(ctx, record, previousStatus, "cancelled"); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(ctx, record)
	return record, nil
}

func (s *Service) RetryWorkflowRun(ctx context.Context, input RetryWorkflowRunInput) (workflow.WorkflowRun, error) {
	record, ok := s.repo.GetWorkflowRun(strings.TrimSpace(input.WorkflowRunID))
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	if s.policy != nil {
		if err := s.policy.EvaluateWorkflowRecoveryAllowed(record); err != nil {
			return workflow.WorkflowRun{}, err
		}
	}

	record.AttemptCount++
	record.ExternalRequestID = ""
	record.LastError = ""
	previousStatus := record.Status
	record.Status = workflow.StatusPending
	record.CurrentStep = attemptStepKey(record.AttemptCount, "dispatch")
	record.UpdatedAt = time.Now().UTC()
	if err := s.saveWorkflowRunState(ctx, record, previousStatus, "retry_queued"); err != nil {
		return workflow.WorkflowRun{}, err
	}
	if _, err := s.createAttemptStep(ctx, record, "dispatch", workflow.StatusCompleted); err != nil {
		return workflow.WorkflowRun{}, err
	}
	if err := s.enqueueWorkflowJob(ctx, record); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(ctx, record)
	return record, nil
}

func (s *Service) ProcessNextWorkflowJob(ctx context.Context) (bool, error) {
	if s == nil || s.repo == nil {
		return false, errors.New("workflowapp: repository is required")
	}
	job, ok, err := s.repo.ClaimNextJob(ctx, workflow.JobTypeWorkflowDispatch)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	if s.executor == nil {
		return true, errors.New("workflowapp: executor is required")
	}
	return true, s.processWorkflowJob(ctx, job)
}

func (s *Service) processWorkflowJob(ctx context.Context, job workflow.Job) error {
	payload, err := parseWorkflowJobPayload(job)
	if err != nil {
		return s.failJobOnly(ctx, job, "invalid_payload", err.Error())
	}
	run, ok := s.repo.GetWorkflowRun(payload.WorkflowRunID)
	if !ok {
		return s.failJobOnly(ctx, job, "workflow_run_missing", fmt.Sprintf("workflow run %s not found", payload.WorkflowRunID))
	}
	if run.Status == workflow.StatusCancelled {
		return s.cancelJobOnly(ctx, job)
	}
	if payload.AttemptCount > 0 && payload.AttemptCount != run.AttemptCount {
		return s.cancelJobOnly(ctx, job)
	}

	now := time.Now().UTC()
	gatewayStep, err := s.ensureGatewayStep(ctx, run, now)
	if err != nil {
		return err
	}

	previousStatus := run.Status
	run.Status = workflow.StatusRunning
	run.CurrentStep = gatewayStep.StepKey
	run.LastError = ""
	run.UpdatedAt = now
	if err := s.saveWorkflowRunState(ctx, run, previousStatus, "claimed"); err != nil {
		return err
	}
	s.publishWorkflowUpdated(ctx, run)

	result, execErr := s.executor.Execute(ctx, gateway.GatewayRequest{
		WorkflowRunID:     run.ID,
		ResourceID:        run.ResourceID,
		Provider:          run.Provider,
		IdempotencyKey:    run.IdempotencyKey,
		ExternalRequestID: run.ExternalRequestID,
	})

	refreshedJob, _ := s.repo.GetJob(job.ID)
	refreshedRun, foundRun := s.repo.GetWorkflowRun(run.ID)
	if refreshedJob.Status == workflow.StatusCancelled || (foundRun && refreshedRun.Status == workflow.StatusCancelled) {
		return s.discardCancelledResult(ctx, chooseJob(job, refreshedJob), chooseRun(run, refreshedRun, foundRun))
	}

	if execErr != nil {
		gatewayStep.Status = workflow.StatusFailed
		gatewayStep.ErrorCode = "provider_error"
		gatewayStep.ErrorMessage = execErr.Error()
		gatewayStep.FailedAt = time.Now().UTC()
		gatewayStep.UpdatedAt = gatewayStep.FailedAt
		if err := s.repo.SaveWorkflowStep(ctx, gatewayStep); err != nil {
			return fmt.Errorf("workflowapp: save failed workflow step: %w", err)
		}

		job.Status = workflow.StatusFailed
		job.ErrorCode = "provider_error"
		job.ErrorMessage = execErr.Error()
		job.FailedAt = gatewayStep.FailedAt
		job.UpdatedAt = gatewayStep.FailedAt
		if err := s.repo.SaveJob(ctx, job); err != nil {
			return err
		}

		run.Status = workflow.StatusFailed
		run.LastError = execErr.Error()
		run.CurrentStep = gatewayStep.StepKey
		run.UpdatedAt = gatewayStep.FailedAt
		if err := s.saveWorkflowRunState(ctx, run, workflow.StatusRunning, "gateway_failed"); err != nil {
			return err
		}
		s.publishWorkflowUpdated(ctx, run)
		return nil
	}

	completedAt := time.Now().UTC()
	gatewayStep.Status = workflow.StatusCompleted
	gatewayStep.ErrorCode = ""
	gatewayStep.ErrorMessage = ""
	gatewayStep.CompletedAt = completedAt
	gatewayStep.UpdatedAt = completedAt
	if err := s.repo.SaveWorkflowStep(ctx, gatewayStep); err != nil {
		return err
	}

	job.Status = workflow.StatusCompleted
	job.ErrorCode = ""
	job.ErrorMessage = ""
	job.CompletedAt = completedAt
	job.UpdatedAt = completedAt
	if err := s.repo.SaveJob(ctx, job); err != nil {
		return err
	}

	run.Provider = selectGatewayProvider(run.Provider, result.Provider)
	run.ExternalRequestID = strings.TrimSpace(result.ExternalRequestID)
	run.LastError = ""
	run.CurrentStep = gatewayStep.StepKey
	run.UpdatedAt = completedAt
	if err := s.repo.SaveWorkflowRun(ctx, run); err != nil {
		return err
	}
	s.publishWorkflowUpdated(ctx, run)
	return nil
}

func (s *Service) enqueueWorkflowJob(ctx context.Context, run workflow.WorkflowRun) error {
	now := time.Now().UTC()
	payload, err := json.Marshal(workflowJobPayload{
		WorkflowRunID: run.ID,
		AttemptCount:  run.AttemptCount,
	})
	if err != nil {
		return fmt.Errorf("workflowapp: encode workflow job payload: %w", err)
	}
	return s.repo.SaveJob(ctx, workflow.Job{
		ID:           s.repo.GenerateJobID(),
		OrgID:        run.OrgID,
		ProjectID:    run.ProjectID,
		ResourceType: workflow.ResourceTypeWorkflowRun,
		ResourceID:   run.ID,
		JobType:      workflow.JobTypeWorkflowDispatch,
		Status:       workflow.StatusPending,
		Priority:     100,
		Payload:      string(payload),
		ScheduledAt:  now,
		CreatedAt:    now,
		UpdatedAt:    now,
	})
}

func (s *Service) ensureGatewayStep(ctx context.Context, run workflow.WorkflowRun, now time.Time) (workflow.WorkflowStep, error) {
	stepKey := attemptStepKey(run.AttemptCount, "gateway")
	if step, ok := s.findWorkflowStep(run.ID, stepKey); ok {
		if step.Status != workflow.StatusRunning {
			step.Status = workflow.StatusRunning
			step.ErrorCode = ""
			step.ErrorMessage = ""
			if step.StartedAt.IsZero() {
				step.StartedAt = now
			}
			step.UpdatedAt = now
			if err := s.repo.SaveWorkflowStep(ctx, step); err != nil {
				return workflow.WorkflowStep{}, err
			}
		}
		return step, nil
	}
	return s.createAttemptStep(ctx, run, "gateway", workflow.StatusRunning)
}

func (s *Service) cancelAttemptGatewayStep(ctx context.Context, run workflow.WorkflowRun, now time.Time) error {
	gatewayKey := attemptStepKey(run.AttemptCount, "gateway")
	step, ok := s.findWorkflowStep(run.ID, gatewayKey)
	if !ok {
		return nil
	}
	if step.Status != workflow.StatusPending && step.Status != workflow.StatusRunning {
		return nil
	}
	step.Status = workflow.StatusCancelled
	step.ErrorCode = ""
	step.ErrorMessage = ""
	step.UpdatedAt = now
	return s.repo.SaveWorkflowStep(ctx, step)
}

func (s *Service) discardCancelledResult(ctx context.Context, job workflow.Job, run workflow.WorkflowRun) error {
	now := time.Now().UTC()
	if job.Status != workflow.StatusCancelled {
		job.Status = workflow.StatusCancelled
		job.UpdatedAt = now
		if err := s.repo.SaveJob(ctx, job); err != nil {
			return err
		}
	}
	return s.cancelAttemptGatewayStep(ctx, run, now)
}

func (s *Service) failJobOnly(ctx context.Context, job workflow.Job, code string, message string) error {
	now := time.Now().UTC()
	job.Status = workflow.StatusFailed
	job.ErrorCode = strings.TrimSpace(code)
	job.ErrorMessage = strings.TrimSpace(message)
	job.FailedAt = now
	job.UpdatedAt = now
	return s.repo.SaveJob(ctx, job)
}

func (s *Service) cancelJobOnly(ctx context.Context, job workflow.Job) error {
	job.Status = workflow.StatusCancelled
	job.ErrorCode = ""
	job.ErrorMessage = ""
	job.UpdatedAt = time.Now().UTC()
	return s.repo.SaveJob(ctx, job)
}

func (s *Service) createAttemptStep(ctx context.Context, run workflow.WorkflowRun, suffix string, status string) (workflow.WorkflowStep, error) {
	now := time.Now().UTC()
	step := workflow.WorkflowStep{
		ID:            s.repo.GenerateWorkflowStepID(),
		WorkflowRunID: run.ID,
		StepKey:       attemptStepKey(run.AttemptCount, suffix),
		StepOrder:     s.nextAttemptStepOrder(run, suffix),
		Status:        status,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	switch status {
	case workflow.StatusRunning:
		step.StartedAt = now
	case workflow.StatusCompleted:
		step.StartedAt = now
		step.CompletedAt = now
	}
	if err := s.repo.SaveWorkflowStep(ctx, step); err != nil {
		return workflow.WorkflowStep{}, err
	}
	return step, nil
}

func (s *Service) nextAttemptStepOrder(run workflow.WorkflowRun, suffix string) int {
	if strings.TrimSpace(suffix) != "cancel" {
		return attemptStepOrder(run.AttemptCount, suffix)
	}
	steps := s.repo.ListWorkflowSteps(run.ID)
	prefix := fmt.Sprintf("attempt_%d.", run.AttemptCount)
	for i := len(steps) - 1; i >= 0; i-- {
		if strings.HasPrefix(steps[i].StepKey, prefix) {
			return steps[i].StepOrder + 1
		}
	}
	return attemptStepOrder(run.AttemptCount, suffix)
}

func (s *Service) findWorkflowStep(workflowRunID string, stepKey string) (workflow.WorkflowStep, bool) {
	for _, step := range s.repo.ListWorkflowSteps(workflowRunID) {
		if step.StepKey == stepKey {
			return step, true
		}
	}
	return workflow.WorkflowStep{}, false
}

func (s *Service) saveWorkflowRunState(ctx context.Context, run workflow.WorkflowRun, previousStatus string, reason string) error {
	if err := s.repo.SaveWorkflowRun(ctx, run); err != nil {
		return err
	}
	if strings.TrimSpace(previousStatus) == strings.TrimSpace(run.Status) {
		return nil
	}
	return s.repo.SaveStateTransition(ctx, workflow.StateTransition{
		ID:           s.repo.GenerateStateTransitionID(),
		OrgID:        run.OrgID,
		ProjectID:    run.ProjectID,
		ResourceType: workflow.ResourceTypeWorkflowRun,
		ResourceID:   run.ID,
		FromState:    strings.TrimSpace(previousStatus),
		ToState:      strings.TrimSpace(run.Status),
		Reason:       strings.TrimSpace(reason),
		CreatedAt:    time.Now().UTC(),
	})
}

func (s *Service) publishWorkflowUpdated(ctx context.Context, run workflow.WorkflowRun) {
	if s == nil || s.publisher == nil {
		return
	}
	payload, err := json.Marshal(map[string]any{
		"workflow_run_id":     run.ID,
		"workflow_type":       run.WorkflowType,
		"status":              run.Status,
		"attempt_count":       run.AttemptCount,
		"last_error":          run.LastError,
		"external_request_id": run.ExternalRequestID,
	})
	if err != nil {
		return
	}
	s.publisher.PublishWithContext(ctx, events.Event{
		EventType:      "workflow.updated",
		OrganizationID: run.OrgID,
		ProjectID:      run.ProjectID,
		ResourceType:   "workflow_run",
		ResourceID:     run.ID,
		Payload:        string(payload),
	})
}

func parseWorkflowJobPayload(job workflow.Job) (workflowJobPayload, error) {
	payload := workflowJobPayload{}
	if strings.TrimSpace(job.Payload) != "" {
		if err := json.Unmarshal([]byte(job.Payload), &payload); err != nil {
			return workflowJobPayload{}, fmt.Errorf("workflowapp: decode workflow job payload: %w", err)
		}
	}
	if strings.TrimSpace(payload.WorkflowRunID) == "" {
		payload.WorkflowRunID = strings.TrimSpace(job.ResourceID)
	}
	if payload.AttemptCount <= 0 {
		payload.AttemptCount = 1
	}
	if strings.TrimSpace(payload.WorkflowRunID) == "" {
		return workflowJobPayload{}, errors.New("workflowapp: workflow job payload missing workflow_run_id")
	}
	return payload, nil
}

func chooseRun(fallback workflow.WorkflowRun, current workflow.WorkflowRun, ok bool) workflow.WorkflowRun {
	if ok {
		return current
	}
	return fallback
}

func chooseJob(fallback workflow.Job, current workflow.Job) workflow.Job {
	if strings.TrimSpace(current.ID) != "" {
		return current
	}
	return fallback
}

func resolveProvider(workflowType string, provider string) (string, error) {
	if trimmedProvider := strings.TrimSpace(provider); trimmedProvider != "" {
		return trimmedProvider, nil
	}

	normalizedWorkflowType := strings.TrimSpace(workflowType)
	if resolvedProvider, ok := defaultProviderByWorkflowType[normalizedWorkflowType]; ok {
		return resolvedProvider, nil
	}

	return "", fmt.Errorf("workflowapp: provider is required for workflow_type %s", normalizedWorkflowType)
}

func selectGatewayProvider(currentProvider string, resultProvider string) string {
	if trimmedProvider := strings.TrimSpace(resultProvider); trimmedProvider != "" {
		return trimmedProvider
	}
	return strings.TrimSpace(currentProvider)
}

func normalizeIdempotencyKey(input StartWorkflowInput) string {
	if strings.TrimSpace(input.IdempotencyKey) != "" {
		return strings.TrimSpace(input.IdempotencyKey)
	}
	return fmt.Sprintf("%s:%s", strings.TrimSpace(input.WorkflowType), strings.TrimSpace(input.ResourceID))
}

func attemptStepKey(attempt int, suffix string) string {
	return fmt.Sprintf("attempt_%d.%s", attempt, strings.TrimSpace(suffix))
}

func attemptStepOrder(attempt int, suffix string) int {
	base := (attempt - 1) * 2
	switch strings.TrimSpace(suffix) {
	case "dispatch":
		return base + 1
	default:
		return base + 2
	}
}
