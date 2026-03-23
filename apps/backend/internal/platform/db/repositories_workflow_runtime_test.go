package db

import (
	"context"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/workflow"
)

func TestMemoryStoreClaimNextJobRespectsPriorityAndCreatedAt(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	now := time.Now().UTC()

	for _, job := range []workflow.Job{
		{
			ID:           store.NextJobID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-1",
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     200,
			Payload:      `{"workflow_run_id":"workflow-run-1","attempt_count":1}`,
			CreatedAt:    now.Add(2 * time.Second),
			UpdatedAt:    now.Add(2 * time.Second),
			ScheduledAt:  now.Add(-1 * time.Minute),
		},
		{
			ID:           store.NextJobID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-2",
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     100,
			Payload:      `{"workflow_run_id":"workflow-run-2","attempt_count":1}`,
			CreatedAt:    now,
			UpdatedAt:    now,
			ScheduledAt:  now.Add(-1 * time.Minute),
		},
		{
			ID:           store.NextJobID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-3",
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     100,
			Payload:      `{"workflow_run_id":"workflow-run-3","attempt_count":1}`,
			CreatedAt:    now.Add(1 * time.Second),
			UpdatedAt:    now.Add(1 * time.Second),
			ScheduledAt:  now.Add(-1 * time.Minute),
		},
	} {
		if err := store.SaveJob(ctx, job); err != nil {
			t.Fatalf("SaveJob returned error: %v", err)
		}
	}

	first, ok, err := store.ClaimNextJob(ctx, workflow.JobTypeWorkflowDispatch)
	if err != nil {
		t.Fatalf("ClaimNextJob returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected first claim to return a job")
	}
	if got := first.ResourceID; got != "workflow-run-1" {
		t.Fatalf("expected highest-priority job workflow-run-1, got %q", got)
	}
	if got := first.Status; got != workflow.StatusRunning {
		t.Fatalf("expected claimed job status running, got %q", got)
	}
	if first.StartedAt.IsZero() {
		t.Fatalf("expected claimed job started_at to be set")
	}

	second, ok, err := store.ClaimNextJob(ctx, workflow.JobTypeWorkflowDispatch)
	if err != nil {
		t.Fatalf("second ClaimNextJob returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected second claim to return a job")
	}
	if got := second.ResourceID; got != "workflow-run-2" {
		t.Fatalf("expected second job workflow-run-2, got %q", got)
	}
}

func TestMemoryStoreListStateTransitionsReturnsChronologicalOrder(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	now := time.Now().UTC()

	for _, transition := range []workflow.StateTransition{
		{
			ID:           store.NextStateTransitionID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-1",
			FromState:    workflow.StatusRunning,
			ToState:      workflow.StatusFailed,
			Reason:       "gateway_failed",
			CreatedAt:    now.Add(2 * time.Second),
		},
		{
			ID:           store.NextStateTransitionID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-1",
			FromState:    "",
			ToState:      workflow.StatusPending,
			Reason:       "queued",
			CreatedAt:    now,
		},
		{
			ID:           store.NextStateTransitionID(),
			OrgID:        "org-1",
			ProjectID:    "project-1",
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   "workflow-run-1",
			FromState:    workflow.StatusPending,
			ToState:      workflow.StatusRunning,
			Reason:       "claimed",
			CreatedAt:    now.Add(1 * time.Second),
		},
	} {
		if err := store.SaveStateTransition(ctx, transition); err != nil {
			t.Fatalf("SaveStateTransition returned error: %v", err)
		}
	}

	transitions := store.ListStateTransitions(workflow.ResourceTypeWorkflowRun, "workflow-run-1")
	if len(transitions) != 3 {
		t.Fatalf("expected 3 state transitions, got %d", len(transitions))
	}
	if got := transitions[0].ToState; got != workflow.StatusPending {
		t.Fatalf("expected first transition pending, got %q", got)
	}
	if got := transitions[1].ToState; got != workflow.StatusRunning {
		t.Fatalf("expected second transition running, got %q", got)
	}
	if got := transitions[2].ToState; got != workflow.StatusFailed {
		t.Fatalf("expected third transition failed, got %q", got)
	}
}
