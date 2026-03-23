package workflowapp

import (
	"context"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestStartWorkflowQueuesRunDispatchStepAndJob(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))

	record, err := service.StartWorkflow(ctx, StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "asset.import",
		ResourceID:     "batch-1",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	if got := record.Status; got != workflow.StatusPending {
		t.Fatalf("expected pending status, got %q", got)
	}
	if got := record.AttemptCount; got != 1 {
		t.Fatalf("expected attempt_count 1, got %d", got)
	}
	if got := record.CurrentStep; got != "attempt_1.dispatch" {
		t.Fatalf("expected current_step attempt_1.dispatch, got %q", got)
	}
	if got := record.Provider; got != "seedance" {
		t.Fatalf("expected provider seedance, got %q", got)
	}
	if got := record.ExternalRequestID; got != "" {
		t.Fatalf("expected empty external_request_id before worker claim, got %q", got)
	}

	steps := store.ListWorkflowSteps(record.ID)
	if len(steps) != 1 {
		t.Fatalf("expected 1 workflow step, got %d", len(steps))
	}
	if got := steps[0].StepKey; got != "attempt_1.dispatch" {
		t.Fatalf("expected dispatch step, got %q", got)
	}
	if got := steps[0].Status; got != workflow.StatusCompleted {
		t.Fatalf("expected dispatch step completed, got %q", got)
	}

	jobs := store.ListJobs(workflow.ResourceTypeWorkflowRun, record.ID, workflow.JobTypeWorkflowDispatch, "")
	if len(jobs) != 1 {
		t.Fatalf("expected 1 queued workflow job, got %d", len(jobs))
	}
	if got := jobs[0].Status; got != workflow.StatusPending {
		t.Fatalf("expected pending workflow job, got %q", got)
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, record.ID)
	if len(transitions) != 1 {
		t.Fatalf("expected 1 workflow state transition, got %d", len(transitions))
	}
	if got := transitions[0].FromState; got != "" {
		t.Fatalf("expected empty from_state for first transition, got %q", got)
	}
	if got := transitions[0].ToState; got != workflow.StatusPending {
		t.Fatalf("expected pending transition, got %q", got)
	}
}

func TestRetryWorkflowRunRequeuesFailedAttemptWithoutSyncExecution(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))

	now := time.Now().UTC()
	record := workflow.WorkflowRun{
		ID:                store.NextWorkflowRunID(),
		OrgID:             "org-1",
		ProjectID:         "project-1",
		ResourceID:        "shot-exec-1",
		WorkflowType:      "shot_pipeline",
		Status:            workflow.StatusFailed,
		LastError:         "provider failed",
		CurrentStep:       "attempt_1.gateway",
		AttemptCount:      1,
		Provider:          "seedance",
		IdempotencyKey:    "idem-1",
		ExternalRequestID: "external-request-1",
		CreatedAt:         now.Add(-2 * time.Minute),
		UpdatedAt:         now.Add(-1 * time.Minute),
	}
	if err := store.SaveWorkflowRun(ctx, record); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}
	if err := store.SaveWorkflowStep(ctx, workflow.WorkflowStep{
		ID:            store.NextWorkflowStepID(),
		WorkflowRunID: record.ID,
		StepKey:       "attempt_1.dispatch",
		StepOrder:     1,
		Status:        workflow.StatusCompleted,
		StartedAt:     now.Add(-90 * time.Second),
		CompletedAt:   now.Add(-90 * time.Second),
		CreatedAt:     now.Add(-90 * time.Second),
		UpdatedAt:     now.Add(-90 * time.Second),
	}); err != nil {
		t.Fatalf("SaveWorkflowStep dispatch returned error: %v", err)
	}
	if err := store.SaveWorkflowStep(ctx, workflow.WorkflowStep{
		ID:            store.NextWorkflowStepID(),
		WorkflowRunID: record.ID,
		StepKey:       "attempt_1.gateway",
		StepOrder:     2,
		Status:        workflow.StatusFailed,
		ErrorCode:     "provider_error",
		ErrorMessage:  "provider failed",
		StartedAt:     now.Add(-60 * time.Second),
		FailedAt:      now.Add(-30 * time.Second),
		CreatedAt:     now.Add(-60 * time.Second),
		UpdatedAt:     now.Add(-30 * time.Second),
	}); err != nil {
		t.Fatalf("SaveWorkflowStep gateway returned error: %v", err)
	}

	retried, err := service.RetryWorkflowRun(ctx, RetryWorkflowRunInput{WorkflowRunID: record.ID})
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error: %v", err)
	}
	if got := retried.Status; got != workflow.StatusPending {
		t.Fatalf("expected retried status pending, got %q", got)
	}
	if got := retried.AttemptCount; got != 2 {
		t.Fatalf("expected attempt_count 2 after retry, got %d", got)
	}
	if got := retried.CurrentStep; got != "attempt_2.dispatch" {
		t.Fatalf("expected current_step attempt_2.dispatch after retry, got %q", got)
	}
	if got := retried.ExternalRequestID; got != "" {
		t.Fatalf("expected retry response to clear external_request_id, got %q", got)
	}
	if got := retried.LastError; got != "" {
		t.Fatalf("expected retry response to clear last_error, got %q", got)
	}

	steps := store.ListWorkflowSteps(record.ID)
	if len(steps) != 3 {
		t.Fatalf("expected 3 workflow steps after retry queueing, got %d", len(steps))
	}
	if got := steps[2].StepKey; got != "attempt_2.dispatch" {
		t.Fatalf("expected third step attempt_2.dispatch, got %q", got)
	}

	jobs := store.ListJobs(workflow.ResourceTypeWorkflowRun, record.ID, workflow.JobTypeWorkflowDispatch, workflow.StatusPending)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 pending workflow job after retry, got %d", len(jobs))
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, record.ID)
	if len(transitions) != 1 {
		t.Fatalf("expected 1 workflow transition after retry, got %d", len(transitions))
	}
	if got := transitions[0].FromState; got != workflow.StatusFailed {
		t.Fatalf("expected retry transition from failed, got %q", got)
	}
	if got := transitions[0].ToState; got != workflow.StatusPending {
		t.Fatalf("expected retry transition to pending, got %q", got)
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
		})
	}
}

func TestCancelWorkflowRunCancelsPendingJobAndAddsCancelAuditStep(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store.Publisher(), nil, policyapp.NewService(store))

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

	cancelled, err := service.CancelWorkflowRun(ctx, CancelWorkflowRunInput{WorkflowRunID: record.ID})
	if err != nil {
		t.Fatalf("CancelWorkflowRun returned error: %v", err)
	}
	if got := cancelled.Status; got != workflow.StatusCancelled {
		t.Fatalf("expected cancelled status, got %q", got)
	}
	if got := cancelled.CurrentStep; got != "attempt_1.cancel" {
		t.Fatalf("expected current_step attempt_1.cancel, got %q", got)
	}
	if got := cancelled.ExternalRequestID; got != "" {
		t.Fatalf("expected empty external_request_id after cancelling pending run, got %q", got)
	}

	steps := store.ListWorkflowSteps(record.ID)
	if len(steps) != 2 {
		t.Fatalf("expected 2 workflow steps after cancel, got %d", len(steps))
	}
	if got := steps[1].StepKey; got != "attempt_1.cancel" {
		t.Fatalf("expected cancel step attempt_1.cancel, got %q", got)
	}
	if got := steps[1].Status; got != workflow.StatusCompleted {
		t.Fatalf("expected cancel step completed, got %q", got)
	}

	jobs := store.ListJobs(workflow.ResourceTypeWorkflowRun, record.ID, workflow.JobTypeWorkflowDispatch, "")
	if len(jobs) != 1 {
		t.Fatalf("expected 1 workflow job to remain stored, got %d", len(jobs))
	}
	if got := jobs[0].Status; got != workflow.StatusCancelled {
		t.Fatalf("expected queued workflow job to be cancelled, got %q", got)
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, record.ID)
	if len(transitions) != 2 {
		t.Fatalf("expected 2 workflow state transitions after cancel, got %d", len(transitions))
	}
	if got := transitions[1].FromState; got != workflow.StatusPending {
		t.Fatalf("expected cancel transition from pending, got %q", got)
	}
	if got := transitions[1].ToState; got != workflow.StatusCancelled {
		t.Fatalf("expected cancel transition to cancelled, got %q", got)
	}
}

func TestCancelWorkflowRunRejectsTerminalStatuses(t *testing.T) {
	ctx := context.Background()
	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
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
