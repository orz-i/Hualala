package workflowapp

import (
	"context"
	"errors"
	"testing"

	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

func TestStartWorkflowCreatesRunAndSteps(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	policy := policyapp.NewService(store)
	gateway := gatewayapp.NewService(store, gatewayapp.NewFakeAdapter())
	service := NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gateway), policy)

	record, err := service.StartWorkflow(ctx, StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceID:     "shot-exec-1",
		Provider:       "seedance",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	if got := record.AttemptCount; got != 1 {
		t.Fatalf("expected attempt_count 1, got %d", got)
	}
	if got := record.CurrentStep; got != "attempt_1.gateway" {
		t.Fatalf("expected current_step attempt_1.gateway, got %q", got)
	}
	if got := record.Provider; got != "seedance" {
		t.Fatalf("expected provider seedance, got %q", got)
	}
	steps := store.ListWorkflowSteps(record.ID)
	if len(steps) != 2 {
		t.Fatalf("expected 2 workflow steps, got %d", len(steps))
	}
	if got := steps[0].StepKey; got != "attempt_1.dispatch" {
		t.Fatalf("expected first step attempt_1.dispatch, got %q", got)
	}
	if got := steps[1].StepKey; got != "attempt_1.gateway" {
		t.Fatalf("expected second step attempt_1.gateway, got %q", got)
	}
	if got := steps[1].Status; got != workflow.StatusCompleted {
		t.Fatalf("expected gateway step completed, got %q", got)
	}
}

func TestStartWorkflowFailureAndRetryCreateNewAttemptSteps(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	adapter := gatewayapp.NewFakeAdapter()
	adapter.SetProviderFailure("seedance", errors.New("provider failed"))
	policy := policyapp.NewService(store)
	gateway := gatewayapp.NewService(store, adapter)
	service := NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gateway), policy)

	failed, err := service.StartWorkflow(ctx, StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceID:     "shot-exec-2",
		Provider:       "seedance",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}
	if got := failed.Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed status, got %q", got)
	}
	if got := failed.LastError; got != "provider failed" {
		t.Fatalf("expected last_error provider failed, got %q", got)
	}
	firstAttemptSteps := store.ListWorkflowSteps(failed.ID)
	if len(firstAttemptSteps) != 2 {
		t.Fatalf("expected 2 workflow steps after first attempt, got %d", len(firstAttemptSteps))
	}
	if got := firstAttemptSteps[1].Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed gateway step, got %q", got)
	}
	if got := firstAttemptSteps[1].ErrorMessage; got != "provider failed" {
		t.Fatalf("expected gateway step error_message provider failed, got %q", got)
	}

	adapter.ClearProviderFailure("seedance")
	retried, err := service.RetryWorkflowRun(ctx, RetryWorkflowRunInput{
		WorkflowRunID: failed.ID,
	})
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error: %v", err)
	}
	if got := retried.AttemptCount; got != 2 {
		t.Fatalf("expected attempt_count 2 after retry, got %d", got)
	}
	if got := retried.CurrentStep; got != "attempt_2.gateway" {
		t.Fatalf("expected current_step attempt_2.gateway after retry, got %q", got)
	}
	allSteps := store.ListWorkflowSteps(failed.ID)
	if len(allSteps) != 4 {
		t.Fatalf("expected 4 workflow steps after retry, got %d", len(allSteps))
	}
	if got := allSteps[2].StepKey; got != "attempt_2.dispatch" {
		t.Fatalf("expected third step attempt_2.dispatch, got %q", got)
	}
	if got := allSteps[3].StepKey; got != "attempt_2.gateway" {
		t.Fatalf("expected fourth step attempt_2.gateway, got %q", got)
	}
}

func TestListWorkflowRunsFiltersByProjectResourceStatusAndType(t *testing.T) {
	store := db.NewMemoryStore()
	ctx := context.Background()

	if err := store.SaveWorkflowRun(ctx, workflow.WorkflowRun{
		ID:           "run-1",
		OrgID:        "org-1",
		ProjectID:    "project-1",
		ResourceID:   "shot-exec-1",
		WorkflowType: "shot_pipeline",
		Status:       workflow.StatusFailed,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}
	if err := store.SaveWorkflowRun(ctx, workflow.WorkflowRun{
		ID:           "run-2",
		OrgID:        "org-1",
		ProjectID:    "project-1",
		ResourceID:   "shot-exec-2",
		WorkflowType: "asset_import",
		Status:       workflow.StatusRunning,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}
	if err := store.SaveWorkflowRun(ctx, workflow.WorkflowRun{
		ID:           "run-3",
		OrgID:        "org-1",
		ProjectID:    "project-2",
		ResourceID:   "shot-exec-1",
		WorkflowType: "shot_pipeline",
		Status:       workflow.StatusFailed,
	}); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}

	service := NewService(store, store.Publisher(), nil, nil)
	records, err := service.ListWorkflowRuns(ctx, ListWorkflowRunsInput{
		ProjectID:    "project-1",
		ResourceID:   "shot-exec-1",
		Status:       workflow.StatusFailed,
		WorkflowType: "shot_pipeline",
	})
	if err != nil {
		t.Fatalf("ListWorkflowRuns returned error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 workflow run after filtering, got %d", len(records))
	}
	if got := records[0].ID; got != "run-1" {
		t.Fatalf("expected run-1 after filtering, got %q", got)
	}
}
