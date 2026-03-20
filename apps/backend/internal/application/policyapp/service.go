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
	store *db.MemoryStore
}

type UploadResumeDecision struct {
	CanRetry    bool
	CanComplete bool
	ResumeHint  string
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) EvaluateBudgetGuard(projectID string, estimatedCostCents int64) error {
	if s == nil || s.store == nil {
		return errors.New("policyapp: store is required")
	}
	if strings.TrimSpace(projectID) == "" || estimatedCostCents <= 0 {
		return nil
	}

	for _, record := range s.store.Budgets {
		if record.ProjectID != strings.TrimSpace(projectID) {
			continue
		}
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
			ResumeHint:  "upload session expired; create a retry session to resume upload",
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
	switch strings.TrimSpace(run.Status) {
	case workflow.StatusFailed, workflow.StatusRunning:
		return nil
	case workflow.StatusCancelled:
		return errors.New("policyapp: cancelled workflow run cannot be retried")
	case workflow.StatusCompleted:
		return errors.New("policyapp: completed workflow run cannot be retried")
	default:
		return errors.New("policyapp: workflow run is not recoverable")
	}
}
