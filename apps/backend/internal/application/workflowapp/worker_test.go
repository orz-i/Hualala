package workflowapp

import (
	"context"
	"errors"
	"testing"

	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

type adapterFunc func(context.Context, gateway.GatewayRequest) (gateway.GatewayResult, error)

func (f adapterFunc) Execute(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	return f(ctx, request)
}

func TestProcessNextWorkflowJobFailsAndRetryRequeuesNextAttempt(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	adapter := gatewayapp.NewFakeAdapter()
	adapter.SetProviderFailure("seedance", errors.New("provider failed"))
	gatewayService := gatewayapp.NewService(store, adapter)
	service := NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gatewayService), policyapp.NewService(store))

	queued, err := service.StartWorkflow(ctx, StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceID:     "shot-exec-2",
		Provider:       "seedance",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	processed, err := service.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected a queued workflow job to be processed")
	}

	failed, err := service.GetWorkflowRun(ctx, GetWorkflowRunInput{WorkflowRunID: queued.ID})
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := failed.Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed workflow status, got %q", got)
	}
	if got := failed.CurrentStep; got != "attempt_1.gateway" {
		t.Fatalf("expected current_step attempt_1.gateway, got %q", got)
	}
	if got := failed.LastError; got != "provider failed" {
		t.Fatalf("expected last_error provider failed, got %q", got)
	}

	steps := store.ListWorkflowSteps(failed.ID)
	if len(steps) != 2 {
		t.Fatalf("expected 2 workflow steps after failure, got %d", len(steps))
	}
	if got := steps[1].Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed gateway step, got %q", got)
	}

	jobs := store.ListJobs(workflow.ResourceTypeWorkflowRun, failed.ID, workflow.JobTypeWorkflowDispatch, "")
	if len(jobs) != 1 {
		t.Fatalf("expected 1 workflow job after failure, got %d", len(jobs))
	}
	if got := jobs[0].Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed workflow job, got %q", got)
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, failed.ID)
	if len(transitions) != 3 {
		t.Fatalf("expected pending->running->failed transitions, got %d", len(transitions))
	}
	if got := transitions[1].ToState; got != workflow.StatusRunning {
		t.Fatalf("expected second transition to running, got %q", got)
	}
	if got := transitions[2].ToState; got != workflow.StatusFailed {
		t.Fatalf("expected third transition to failed, got %q", got)
	}

	adapter.ClearProviderFailure("seedance")
	retried, err := service.RetryWorkflowRun(ctx, RetryWorkflowRunInput{WorkflowRunID: failed.ID})
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error: %v", err)
	}
	if got := retried.Status; got != workflow.StatusPending {
		t.Fatalf("expected pending status after retry queueing, got %q", got)
	}

	processed, err = service.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob for retry returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected retried workflow job to be processed")
	}

	completed, err := service.GetWorkflowRun(ctx, GetWorkflowRunInput{WorkflowRunID: failed.ID})
	if err != nil {
		t.Fatalf("GetWorkflowRun after retry returned error: %v", err)
	}
	if got := completed.Status; got != workflow.StatusCompleted {
		t.Fatalf("expected completed status after gateway accept, got %q", got)
	}
	if got := completed.AttemptCount; got != 2 {
		t.Fatalf("expected attempt_count 2 after retry processing, got %d", got)
	}
	if got := completed.CurrentStep; got != "attempt_2.gateway" {
		t.Fatalf("expected current_step attempt_2.gateway after retry, got %q", got)
	}
	if completed.ExternalRequestID == "" {
		t.Fatalf("expected worker to populate external_request_id")
	}

	allSteps := store.ListWorkflowSteps(failed.ID)
	if len(allSteps) != 4 {
		t.Fatalf("expected 4 workflow steps after retry processing, got %d", len(allSteps))
	}
	if got := allSteps[3].Status; got != workflow.StatusCompleted {
		t.Fatalf("expected completed gateway step after retry, got %q", got)
	}

	transitions = store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, failed.ID)
	if len(transitions) != 6 {
		t.Fatalf("expected pending->running->failed->pending->running->completed transitions, got %d", len(transitions))
	}
	if got := transitions[5].ToState; got != workflow.StatusCompleted {
		t.Fatalf("expected final transition to completed, got %q", got)
	}
}

func TestProcessNextWorkflowJobDropsLateGatewayResultAfterCancellation(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	var service *Service
	gatewayService := gatewayapp.NewService(store, adapterFunc(func(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
		_, err := service.CancelWorkflowRun(ctx, CancelWorkflowRunInput{WorkflowRunID: request.WorkflowRunID})
		if err != nil {
			return gateway.GatewayResult{}, err
		}
		return gateway.GatewayResult{
			Provider:          request.Provider,
			ExternalRequestID: "external-request-late",
		}, nil
	}))
	service = NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gatewayService), policyapp.NewService(store))

	queued, err := service.StartWorkflow(ctx, StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "asset.import",
		ResourceID:     "batch-2",
		Provider:       "seedance",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	processed, err := service.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected queued workflow job to be processed")
	}

	cancelled, err := service.GetWorkflowRun(ctx, GetWorkflowRunInput{WorkflowRunID: queued.ID})
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := cancelled.Status; got != workflow.StatusCancelled {
		t.Fatalf("expected cancelled workflow status, got %q", got)
	}
	if got := cancelled.CurrentStep; got != "attempt_1.cancel" {
		t.Fatalf("expected current_step attempt_1.cancel, got %q", got)
	}
	if got := cancelled.ExternalRequestID; got != "" {
		t.Fatalf("expected late gateway result to be discarded, got %q", got)
	}

	steps := store.ListWorkflowSteps(queued.ID)
	if len(steps) != 3 {
		t.Fatalf("expected dispatch, gateway, cancel steps, got %d", len(steps))
	}
	if got := steps[1].Status; got != workflow.StatusCancelled {
		t.Fatalf("expected gateway step to be cancelled after late cancellation, got %q", got)
	}
	if got := steps[2].Status; got != workflow.StatusCompleted {
		t.Fatalf("expected cancel audit step completed, got %q", got)
	}

	jobs := store.ListJobs(workflow.ResourceTypeWorkflowRun, queued.ID, workflow.JobTypeWorkflowDispatch, "")
	if len(jobs) != 1 {
		t.Fatalf("expected 1 workflow job after late cancellation, got %d", len(jobs))
	}
	if got := jobs[0].Status; got != workflow.StatusCancelled {
		t.Fatalf("expected running workflow job to settle as cancelled, got %q", got)
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, queued.ID)
	if len(transitions) != 3 {
		t.Fatalf("expected pending->running->cancelled transitions, got %d", len(transitions))
	}
	if got := transitions[2].ToState; got != workflow.StatusCancelled {
		t.Fatalf("expected final transition to cancelled, got %q", got)
	}
}

func TestProcessNextWorkflowJobReturnsFalseWhenQueueIsEmpty(t *testing.T) {
	service := NewService(db.NewMemoryStore(), nil, nil, policyapp.NewService(db.NewMemoryStore()))

	processed, err := service.ProcessNextWorkflowJob(context.Background())
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
	}
	if processed {
		t.Fatalf("expected no queued workflow jobs to be processed")
	}
}
