package workflowapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
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
	store    *db.MemoryStore
	executor temporal.Executor
	policy   budgetGuard
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

type ListWorkflowRunsInput struct {
	ProjectID string
}

type CancelWorkflowRunInput struct {
	WorkflowRunID string
}

type RetryWorkflowRunInput struct {
	WorkflowRunID string
}

func NewService(store *db.MemoryStore, executor temporal.Executor, policy budgetGuard) *Service {
	return &Service{
		store:    store,
		executor: executor,
		policy:   policy,
	}
}

func (s *Service) StartWorkflow(ctx context.Context, input StartWorkflowInput) (workflow.WorkflowRun, error) {
	if s == nil || s.store == nil {
		return workflow.WorkflowRun{}, errors.New("workflowapp: store is required")
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
		ID:             s.store.NextWorkflowRunID(),
		OrgID:          strings.TrimSpace(input.OrganizationID),
		ProjectID:      strings.TrimSpace(input.ProjectID),
		WorkflowType:   strings.TrimSpace(input.WorkflowType),
		ResourceID:     strings.TrimSpace(input.ResourceID),
		Status:         workflow.StatusPending,
		CurrentStep:    "dispatch",
		AttemptCount:   1,
		Provider:       normalizeProvider(input.Provider),
		IdempotencyKey: normalizeIdempotencyKey(input),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	s.store.WorkflowRuns[run.ID] = run
	if err := s.store.Persist(ctx); err != nil {
		return workflow.WorkflowRun{}, err
	}
	return s.dispatchWorkflow(ctx, run)
}

func (s *Service) GetWorkflowRun(_ context.Context, input GetWorkflowRunInput) (workflow.WorkflowRun, error) {
	record, ok := s.store.WorkflowRuns[strings.TrimSpace(input.WorkflowRunID)]
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	return record, nil
}

func (s *Service) ListWorkflowRuns(_ context.Context, input ListWorkflowRunsInput) ([]workflow.WorkflowRun, error) {
	items := make([]workflow.WorkflowRun, 0)
	for _, record := range s.store.WorkflowRuns {
		if strings.TrimSpace(input.ProjectID) != "" && record.ProjectID != strings.TrimSpace(input.ProjectID) {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items, nil
}

func (s *Service) CancelWorkflowRun(ctx context.Context, input CancelWorkflowRunInput) (workflow.WorkflowRun, error) {
	record, ok := s.store.WorkflowRuns[strings.TrimSpace(input.WorkflowRunID)]
	if !ok {
		return workflow.WorkflowRun{}, fmt.Errorf("workflowapp: workflow run %s not found", strings.TrimSpace(input.WorkflowRunID))
	}
	record.Status = workflow.StatusCancelled
	record.UpdatedAt = time.Now().UTC()
	s.store.WorkflowRuns[record.ID] = record
	if err := s.store.Persist(ctx); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(record)
	return record, nil
}

func (s *Service) RetryWorkflowRun(ctx context.Context, input RetryWorkflowRunInput) (workflow.WorkflowRun, error) {
	record, ok := s.store.WorkflowRuns[strings.TrimSpace(input.WorkflowRunID)]
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
	record.Status = workflow.StatusRunning
	record.UpdatedAt = time.Now().UTC()
	s.store.WorkflowRuns[record.ID] = record
	if err := s.store.Persist(ctx); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(record)
	return s.executeGateway(ctx, record)
}

func (s *Service) dispatchWorkflow(ctx context.Context, run workflow.WorkflowRun) (workflow.WorkflowRun, error) {
	run.Status = workflow.StatusRunning
	run.UpdatedAt = time.Now().UTC()
	s.store.WorkflowRuns[run.ID] = run
	if err := s.store.Persist(ctx); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(run)
	return s.executeGateway(ctx, run)
}

func (s *Service) executeGateway(ctx context.Context, run workflow.WorkflowRun) (workflow.WorkflowRun, error) {
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
		run.Status = workflow.StatusFailed
		run.LastError = err.Error()
		run.UpdatedAt = time.Now().UTC()
		s.store.WorkflowRuns[run.ID] = run
		if persistErr := s.store.Persist(ctx); persistErr != nil {
			return workflow.WorkflowRun{}, persistErr
		}
		s.publishWorkflowUpdated(run)
		return run, nil
	}
	run.ExternalRequestID = result.ExternalRequestID
	run.UpdatedAt = time.Now().UTC()
	s.store.WorkflowRuns[run.ID] = run
	if err := s.store.Persist(ctx); err != nil {
		return workflow.WorkflowRun{}, err
	}
	s.publishWorkflowUpdated(run)
	return run, nil
}

func (s *Service) publishWorkflowUpdated(run workflow.WorkflowRun) {
	if s == nil || s.store == nil || s.store.EventPublisher == nil {
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
	s.store.EventPublisher.Publish(events.Event{
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
