package policyapp

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	budgets db.PolicyReader
}

type UploadResumeDecision struct {
	CanRetry    bool
	CanComplete bool
	ResumeHint  string
}

func NewService(budgets db.PolicyReader) *Service {
	return &Service{budgets: budgets}
}

func (s *Service) EvaluateBudgetGuard(projectID string, estimatedCostCents int64) error {
	if s == nil || s.budgets == nil {
		return errors.New("policyapp: budget reader is required")
	}
	if strings.TrimSpace(projectID) == "" || estimatedCostCents <= 0 {
		return nil
	}
	if record, ok := s.budgets.GetBudgetByProject(strings.TrimSpace(projectID)); ok {
		remaining := record.LimitCents - record.ReservedCents
		if estimatedCostCents > remaining {
			return fmt.Errorf("policyapp: budget exceeded for project %s", strings.TrimSpace(projectID))
		}
	}
	return nil
}

func (s *Service) EvaluateUploadResumeAllowed(session asset.UploadSession) UploadResumeDecision {
	if strings.TrimSpace(session.Status) == "uploaded" {
		return UploadResumeDecision{
			CanRetry:    false,
			CanComplete: false,
			ResumeHint:  fmt.Sprintf("upload complete for %s", session.FileName),
		}
	}
	if !session.ExpiresAt.After(time.Now().UTC()) {
		return UploadResumeDecision{
			CanRetry:    true,
			CanComplete: false,
			ResumeHint:  "upload session expired; retry this session to resume upload",
		}
	}
	if session.RetryCount > 0 {
		return UploadResumeDecision{
			CanRetry:    true,
			CanComplete: true,
			ResumeHint:  fmt.Sprintf("retry from byte 0 for %s", session.FileName),
		}
	}
	return UploadResumeDecision{
		CanRetry:    true,
		CanComplete: true,
		ResumeHint:  fmt.Sprintf("upload %s from byte 0", session.FileName),
	}
}

func (s *Service) EvaluateWorkflowRecoveryAllowed(run workflow.WorkflowRun) error {
	switch status := strings.TrimSpace(run.Status); status {
	case workflow.StatusFailed:
		return nil
	case workflow.StatusRunning, workflow.StatusPending, workflow.StatusCancelled, workflow.StatusCompleted:
		return fmt.Errorf("policyapp: %s workflow run cannot be retried", status)
	default:
		return errors.New("policyapp: workflow run cannot be retried")
	}
}

func (s *Service) EvaluateWorkflowCancellationAllowed(run workflow.WorkflowRun) error {
	switch status := strings.TrimSpace(run.Status); status {
	case workflow.StatusRunning:
		return nil
	case workflow.StatusPending, workflow.StatusFailed, workflow.StatusCompleted, workflow.StatusCancelled:
		return fmt.Errorf("policyapp: %s workflow run cannot be cancelled", status)
	default:
		return errors.New("policyapp: workflow run cannot be cancelled")
	}
}
