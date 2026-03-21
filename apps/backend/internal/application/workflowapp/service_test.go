package workflowapp

import (
	"context"
	"errors"
	"testing"
	"time"

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
	if got := firstAttemptSteps[1].ErrorCode; got != "provider_error" {
		t.Fatalf("expected gateway step error_code provider_error, got %q", got)
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

func TestRetryWorkflowRunRejectsNonFailedStatuses(t *testing.T) {
	ctx := context.Background()
	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
		{name: "running", status: workflow.StatusRunning, wantError: "policyapp: running workflow run cannot be retried"},
		{name: "pending", status: workflow.StatusPending, wantError: "policyapp: pending workflow run cannot be retried"},
		{name: "completed", status: workflow.StatusCompleted, wantError: "policyapp: completed workflow run cannot be retried"},
		{name: "cancelled", status: workflow.StatusCancelled, wantError: "policyapp: cancelled workflow run cannot be retried"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			store := db.NewMemoryStore()
			service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))
			runID := store.NextWorkflowRunID()
			record := workflow.WorkflowRun{
				ID:           runID,
				OrgID:        "org-1",
				ProjectID:    "project-1",
				ResourceID:   "shot-exec-1",
				WorkflowType: "shot_pipeline",
				Status:       tc.status,
				AttemptCount: 1,
			}
			if err := store.SaveWorkflowRun(ctx, record); err != nil {
				t.Fatalf("SaveWorkflowRun returned error: %v", err)
			}

			_, err := service.RetryWorkflowRun(ctx, RetryWorkflowRunInput{WorkflowRunID: runID})
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantError)
			}
			if got := err.Error(); got != tc.wantError {
				t.Fatalf("expected error %q, got %q", tc.wantError, got)
			}

			saved, ok := store.GetWorkflowRun(runID)
			if !ok {
				t.Fatalf("expected workflow run %q to remain stored", runID)
			}
			if got := saved.Status; got != tc.status {
				t.Fatalf("expected workflow status to remain %q, got %q", tc.status, got)
			}
			if steps := store.ListWorkflowSteps(runID); len(steps) != 0 {
				t.Fatalf("expected no workflow steps to be created, got %d", len(steps))
			}
		})
	}
}

func TestCancelWorkflowRunAddsCancelAuditStep(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))

	record := workflow.WorkflowRun{
		ID:           store.NextWorkflowRunID(),
		OrgID:        "org-1",
		ProjectID:    "project-1",
		ResourceID:   "shot-exec-1",
		WorkflowType: "shot_pipeline",
		Status:       workflow.StatusRunning,
		AttemptCount: 2,
		CurrentStep:  "attempt_2.gateway",
		LastError:    "old error",
		CreatedAt:    time.Now().UTC().Add(-2 * time.Minute),
		UpdatedAt:    time.Now().UTC().Add(-1 * time.Minute),
	}
	if err := store.SaveWorkflowRun(ctx, record); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}
	existingStep := workflow.WorkflowStep{
		ID:            store.NextWorkflowStepID(),
		WorkflowRunID: record.ID,
		StepKey:       "attempt_2.gateway",
		StepOrder:     4,
		Status:        workflow.StatusRunning,
		StartedAt:     time.Now().UTC().Add(-30 * time.Second),
		CreatedAt:     time.Now().UTC().Add(-30 * time.Second),
		UpdatedAt:     time.Now().UTC().Add(-30 * time.Second),
	}
	if err := store.SaveWorkflowStep(ctx, existingStep); err != nil {
		t.Fatalf("SaveWorkflowStep returned error: %v", err)
	}

	cancelled, err := service.CancelWorkflowRun(ctx, CancelWorkflowRunInput{WorkflowRunID: record.ID})
	if err != nil {
		t.Fatalf("CancelWorkflowRun returned error: %v", err)
	}
	if got := cancelled.Status; got != workflow.StatusCancelled {
		t.Fatalf("expected cancelled status, got %q", got)
	}
	if got := cancelled.CurrentStep; got != "attempt_2.cancel" {
		t.Fatalf("expected current_step attempt_2.cancel, got %q", got)
	}
	if got := cancelled.LastError; got != "" {
		t.Fatalf("expected last_error cleared, got %q", got)
	}

	steps := store.ListWorkflowSteps(record.ID)
	if len(steps) != 2 {
		t.Fatalf("expected 2 workflow steps after cancel, got %d", len(steps))
	}
	cancelStep := steps[1]
	if got := cancelStep.StepKey; got != "attempt_2.cancel" {
		t.Fatalf("expected cancel step attempt_2.cancel, got %q", got)
	}
	if got := cancelStep.StepOrder; got != 5 {
		t.Fatalf("expected cancel step order 5, got %d", got)
	}
	if got := cancelStep.Status; got != workflow.StatusCompleted {
		t.Fatalf("expected cancel step completed, got %q", got)
	}
	if cancelStep.StartedAt.IsZero() || cancelStep.CompletedAt.IsZero() {
		t.Fatalf("expected cancel step started_at and completed_at to be set")
	}
}

func TestCancelWorkflowRunRejectsNonRunningStatuses(t *testing.T) {
	ctx := context.Background()
	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
		{name: "pending", status: workflow.StatusPending, wantError: "policyapp: pending workflow run cannot be cancelled"},
		{name: "failed", status: workflow.StatusFailed, wantError: "policyapp: failed workflow run cannot be cancelled"},
		{name: "completed", status: workflow.StatusCompleted, wantError: "policyapp: completed workflow run cannot be cancelled"},
		{name: "cancelled", status: workflow.StatusCancelled, wantError: "policyapp: cancelled workflow run cannot be cancelled"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			store := db.NewMemoryStore()
			service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))
			runID := store.NextWorkflowRunID()
			record := workflow.WorkflowRun{
				ID:           runID,
				OrgID:        "org-1",
				ProjectID:    "project-1",
				ResourceID:   "shot-exec-1",
				WorkflowType: "shot_pipeline",
				Status:       tc.status,
				AttemptCount: 1,
			}
			if err := store.SaveWorkflowRun(ctx, record); err != nil {
				t.Fatalf("SaveWorkflowRun returned error: %v", err)
			}

			_, err := service.CancelWorkflowRun(ctx, CancelWorkflowRunInput{WorkflowRunID: runID})
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantError)
			}
			if got := err.Error(); got != tc.wantError {
				t.Fatalf("expected error %q, got %q", tc.wantError, got)
			}

			saved, ok := store.GetWorkflowRun(runID)
			if !ok {
				t.Fatalf("expected workflow run %q to remain stored", runID)
			}
			if got := saved.Status; got != tc.status {
				t.Fatalf("expected workflow status to remain %q, got %q", tc.status, got)
			}
			if steps := store.ListWorkflowSteps(runID); len(steps) != 0 {
				t.Fatalf("expected no workflow steps to be created, got %d", len(steps))
			}
		})
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
