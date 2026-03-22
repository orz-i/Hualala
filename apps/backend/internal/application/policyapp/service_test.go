package policyapp

import (
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestEvaluateBudgetGuardRejectsExceededBudget(t *testing.T) {
	store := db.NewMemoryStore()
	service := NewService(store)
	store.Budgets["budget-1"] = billing.ProjectBudget{
		ID:            "budget-1",
		OrgID:         "org-1",
		ProjectID:     "project-1",
		LimitCents:    100,
		ReservedCents: 80,
	}

	err := service.EvaluateBudgetGuard("project-1", 30)
	if err == nil {
		t.Fatalf("expected budget guard to reject exceeded budget")
	}
	if !strings.Contains(err.Error(), "budget exceeded") {
		t.Fatalf("expected budget exceeded error, got %v", err)
	}
}

func TestEvaluateUploadResumeAllowedReturnsExpiredResumeHint(t *testing.T) {
	store := db.NewMemoryStore()
	service := NewService(store)

	decision := service.EvaluateUploadResumeAllowed(asset.UploadSession{
		ID:        "upload-session-1",
		FileName:  "shot.png",
		Status:    "pending",
		ExpiresAt: time.Now().UTC().Add(-1 * time.Minute),
	})

	if !decision.CanRetry {
		t.Fatalf("expected expired upload session to allow retry-based recovery")
	}
	if decision.CanComplete {
		t.Fatalf("expected expired upload session to reject completion")
	}
	if !strings.Contains(decision.ResumeHint, "retry this session") {
		t.Fatalf("expected expired resume hint, got %q", decision.ResumeHint)
	}
}

func TestEvaluateWorkflowRecoveryAllowedOnlyAllowsFailed(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
		{name: "failed", status: workflow.StatusFailed},
		{name: "running", status: workflow.StatusRunning, wantError: "policyapp: running workflow run cannot be retried"},
		{name: "pending", status: workflow.StatusPending, wantError: "policyapp: pending workflow run cannot be retried"},
		{name: "cancelled", status: workflow.StatusCancelled, wantError: "policyapp: cancelled workflow run cannot be retried"},
		{name: "completed", status: workflow.StatusCompleted, wantError: "policyapp: completed workflow run cannot be retried"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := service.EvaluateWorkflowRecoveryAllowed(workflow.WorkflowRun{Status: tc.status})
			if tc.wantError == "" {
				if err != nil {
					t.Fatalf("expected nil error, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantError)
			}
			if got := err.Error(); got != tc.wantError {
				t.Fatalf("expected error %q, got %q", tc.wantError, got)
			}
		})
	}
}

func TestEvaluateWorkflowCancellationAllowedOnlyAllowsRunning(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
		{name: "running", status: workflow.StatusRunning},
		{name: "pending", status: workflow.StatusPending, wantError: "policyapp: pending workflow run cannot be cancelled"},
		{name: "failed", status: workflow.StatusFailed, wantError: "policyapp: failed workflow run cannot be cancelled"},
		{name: "completed", status: workflow.StatusCompleted, wantError: "policyapp: completed workflow run cannot be cancelled"},
		{name: "cancelled", status: workflow.StatusCancelled, wantError: "policyapp: cancelled workflow run cannot be cancelled"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := service.EvaluateWorkflowCancellationAllowed(workflow.WorkflowRun{Status: tc.status})
			if tc.wantError == "" {
				if err != nil {
					t.Fatalf("expected nil error, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error %q, got nil", tc.wantError)
			}
			if got := err.Error(); got != tc.wantError {
				t.Fatalf("expected error %q, got %q", tc.wantError, got)
			}
		})
	}
}
