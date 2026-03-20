package policyapp

import (
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/billing"
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
	if !strings.Contains(decision.ResumeHint, "create a retry session") {
		t.Fatalf("expected expired resume hint, got %q", decision.ResumeHint)
	}
}
