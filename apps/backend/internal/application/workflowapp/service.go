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
		Provider:       normalizeProvider(input.Provider),
		IdempotencyKey: normalizeIdempotencyKey(input),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.repo.SaveWorkflowRun(ctx, run); err != nil {
		return workflow.WorkflowRun{}, err
	}
	return s.runAttempt(ctx, run)
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
	record, ok := s.repo.GetWorkflowRun(strings.TrimSpace(input.WorkflowRunID))
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	record.Status = workflow.StatusCancelled
	record.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveWorkflowRun(ctx, record); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(record)
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
	record.LastError = ""
	record.Status = workflow.StatusPending
	record.CurrentStep = attemptStepKey(record.AttemptCount, "dispatch")
	record.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveWorkflowRun(ctx, record); err != nil {
		return workflow.WorkflowRun{}, err
	}
	return s.runAttempt(ctx, record)
}

func (s *Service) runAttempt(ctx context.Context, run workflow.WorkflowRun) (workflow.WorkflowRun, error) {
	dispatchStep, err := s.createAttemptStep(ctx, run, "dispatch", workflow.StatusCompleted)
	if err != nil {
		return workflow.WorkflowRun{}, err
	}
	_ = dispatchStep
	gatewayStep, err := s.createAttemptStep(ctx, run, "gateway", workflow.StatusRunning)
	if err != nil {
		return workflow.WorkflowRun{}, err
	}
	run.Status = workflow.StatusRunning
	run.CurrentStep = gatewayStep.StepKey
	run.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveWorkflowRun(ctx, run); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(run)
	return s.executeGateway(ctx, run, gatewayStep)
}

func (s *Service) executeGateway(ctx context.Context, run workflow.WorkflowRun, gatewayStep workflow.WorkflowStep) (workflow.WorkflowRun, error) {
	if s.executor == nil {
		return run, nil
	}
	result, err := s.executor.Execute(ctx, gateway.GatewayRequest{
		WorkflowRunID:     run.ID,
		ResourceID:        run.ResourceID,
		Provider:          run.Provider,
		IdempotencyKey:    run.IdempotencyKey,
		ExternalRequestID: run.ExternalRequestID,
	})
	if err != nil {
		gatewayStep.Status = workflow.StatusFailed
		gatewayStep.ErrorMessage = err.Error()
		gatewayStep.FailedAt = time.Now().UTC()
		gatewayStep.UpdatedAt = gatewayStep.FailedAt
		if persistErr := s.repo.SaveWorkflowStep(ctx, gatewayStep); persistErr != nil {
			return workflow.WorkflowRun{}, persistErr
		}
		run.Status = workflow.StatusFailed
		run.LastError = err.Error()
		run.UpdatedAt = time.Now().UTC()
		if persistErr := s.repo.SaveWorkflowRun(ctx, run); persistErr != nil {
			return workflow.WorkflowRun{}, persistErr
		}
		s.publishWorkflowUpdated(run)
		return run, nil
	}
	gatewayStep.Status = workflow.StatusCompleted
	gatewayStep.CompletedAt = time.Now().UTC()
	gatewayStep.UpdatedAt = gatewayStep.CompletedAt
	if err := s.repo.SaveWorkflowStep(ctx, gatewayStep); err != nil {
		return workflow.WorkflowRun{}, err
	}
	run.ExternalRequestID = result.ExternalRequestID
	run.Provider = normalizeProvider(result.Provider)
	run.LastError = ""
	run.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveWorkflowRun(ctx, run); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(run)
	return run, nil
}

func (s *Service) createAttemptStep(ctx context.Context, run workflow.WorkflowRun, suffix string, status string) (workflow.WorkflowStep, error) {
	now := time.Now().UTC()
	step := workflow.WorkflowStep{
		ID:            s.repo.GenerateWorkflowStepID(),
		WorkflowRunID: run.ID,
		StepKey:       attemptStepKey(run.AttemptCount, suffix),
		StepOrder:     attemptStepOrder(run.AttemptCount, suffix),
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

func (s *Service) publishWorkflowUpdated(run workflow.WorkflowRun) {
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
	s.publisher.Publish(events.Event{
		EventType:      "workflow.updated",
		OrganizationID: run.OrgID,
		ProjectID:      run.ProjectID,
		ResourceType:   "workflow_run",
		ResourceID:     run.ID,
		Payload:        string(payload),
	})
}

func normalizeProvider(provider string) string {
	if strings.TrimSpace(provider) == "" {
		return "memory-provider"
	}
	return strings.TrimSpace(provider)
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
