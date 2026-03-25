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

func TestEvaluateWorkflowCancellationAllowedAllowsPendingAndRunning(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	testCases := []struct {
		name      string
		status    string
		wantError string
	}{
		{name: "pending", status: workflow.StatusPending},
		{name: "running", status: workflow.StatusRunning},
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

func TestEvaluateAssetReusePolicy(t *testing.T) {
	service := NewService(db.NewMemoryStore())

	testCases := []struct {
		name              string
		input             AssetReusePolicyInput
		wantAllowed       bool
		wantConsentStatus string
		wantBlockedReason string
	}{
		{
			name: "blocks missing source project",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "",
				RightsStatus:    "clear",
				ConsentStatus:   "granted",
				AIAnnotated:     false,
			},
			wantAllowed:       false,
			wantConsentStatus: "granted",
			wantBlockedReason: "policyapp: source project is unavailable for cross-project reuse",
		},
		{
			name: "blocks current project asset",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "project-live-1",
				RightsStatus:    "clear",
				ConsentStatus:   "granted",
				AIAnnotated:     false,
			},
			wantAllowed:       false,
			wantConsentStatus: "granted",
			wantBlockedReason: "policyapp: asset belongs to the current project",
		},
		{
			name: "blocks restricted rights",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "project-source-9",
				RightsStatus:    "restricted",
				ConsentStatus:   "granted",
				AIAnnotated:     false,
			},
			wantAllowed:       false,
			wantConsentStatus: "granted",
			wantBlockedReason: "policyapp: rights status does not allow cross-project reuse",
		},
		{
			name: "blocks ai asset without granted consent",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "project-source-9",
				RightsStatus:    "clear",
				ConsentStatus:   "unknown",
				AIAnnotated:     true,
			},
			wantAllowed:       false,
			wantConsentStatus: "unknown",
			wantBlockedReason: "policyapp: consent status must be granted for ai_annotated assets",
		},
		{
			name: "normalizes non-ai unknown consent to not_required",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "project-source-9",
				RightsStatus:    "clear",
				ConsentStatus:   "unknown",
				AIAnnotated:     false,
			},
			wantAllowed:       true,
			wantConsentStatus: "not_required",
		},
		{
			name: "allows ai asset with granted consent",
			input: AssetReusePolicyInput{
				TargetProjectID: "project-live-1",
				SourceProjectID: "project-source-9",
				RightsStatus:    "clear",
				ConsentStatus:   "granted",
				AIAnnotated:     true,
			},
			wantAllowed:       true,
			wantConsentStatus: "granted",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := service.EvaluateAssetReusePolicy(tc.input)
			if got.Allowed != tc.wantAllowed {
				t.Fatalf("expected allowed=%v, got %v", tc.wantAllowed, got.Allowed)
			}
			if got.ConsentStatus != tc.wantConsentStatus {
				t.Fatalf("expected consent_status %q, got %q", tc.wantConsentStatus, got.ConsentStatus)
			}
			if got.BlockedReason != tc.wantBlockedReason {
				t.Fatalf("expected blocked_reason %q, got %q", tc.wantBlockedReason, got.BlockedReason)
			}
		})
	}
}
