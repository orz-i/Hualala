package reviewapp

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	executions     db.ExecutionRepository
	repo           db.ReviewBillingRepository
	eventPublisher *events.Publisher
}

type CreateShotReviewInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
	Conclusion      string `json:"conclusion"`
	CommentLocale   string `json:"comment_locale"`
	Comment         string `json:"comment"`
}

type CreateEvaluationRunInput struct {
	ShotExecutionID string   `json:"shot_execution_id"`
	PassedChecks    []string `json:"passed_checks"`
	FailedChecks    []string `json:"failed_checks"`
}

type ListEvaluationRunsInput struct {
	ShotExecutionID string
}

type ListShotReviewsInput struct {
	ShotExecutionID string
}

type GetShotReviewSummaryInput struct {
	ShotExecutionID string
}

type ShotReviewSummary struct {
	ShotExecutionID  string
	LatestConclusion string
	LatestReviewID   string
}

func NewService(executions db.ExecutionRepository, repo db.ReviewBillingRepository, eventPublisher *events.Publisher) *Service {
	return &Service{executions: executions, repo: repo, eventPublisher: eventPublisher}
}

func (s *Service) CreateShotReview(ctx context.Context, input CreateShotReviewInput) (review.ShotReview, error) {
	if s == nil || s.repo == nil || s.executions == nil {
		return review.ShotReview{}, errors.New("reviewapp: repositories are required")
	}
	shotExecution, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return review.ShotReview{}, errors.New("reviewapp: shot execution not found")
	}
	if strings.TrimSpace(input.Conclusion) == "" {
		return review.ShotReview{}, errors.New("reviewapp: conclusion is required")
	}
	if strings.TrimSpace(input.CommentLocale) == "" {
		return review.ShotReview{}, errors.New("reviewapp: comment_locale is required")
	}

	now := time.Now().UTC()
	record := review.ShotReview{
		ID:              s.repo.GenerateReviewID(),
		ShotExecutionID: strings.TrimSpace(input.ShotExecutionID),
		Conclusion:      strings.TrimSpace(input.Conclusion),
		CommentLocale:   strings.TrimSpace(input.CommentLocale),
		Comment:         strings.TrimSpace(input.Comment),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.repo.SaveReview(ctx, record); err != nil {
		return review.ShotReview{}, err
	}
	s.publishReviewEvent(ctx, "shot.review.created", shotExecution.OrgID, shotExecution.ProjectID, "shot_review", record.ID, map[string]any{
		"shot_execution_id": record.ShotExecutionID,
		"review_id":         record.ID,
		"conclusion":        record.Conclusion,
		"comment_locale":    record.CommentLocale,
	})
	return record, nil
}

func (s *Service) CreateEvaluationRun(ctx context.Context, input CreateEvaluationRunInput) (review.EvaluationRun, error) {
	if s == nil || s.repo == nil || s.executions == nil {
		return review.EvaluationRun{}, errors.New("reviewapp: repositories are required")
	}
	shotExecution, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return review.EvaluationRun{}, errors.New("reviewapp: shot execution not found")
	}

	now := time.Now().UTC()
	record := review.EvaluationRun{
		ID:              s.repo.GenerateEvaluationRunID(),
		ShotExecutionID: strings.TrimSpace(input.ShotExecutionID),
		PassedChecks:    append([]string(nil), input.PassedChecks...),
		FailedChecks:    append([]string(nil), input.FailedChecks...),
		Status:          "passed",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if len(record.FailedChecks) > 0 {
		record.Status = "failed"
	}

	if err := s.repo.SaveEvaluationRun(ctx, record); err != nil {
		return review.EvaluationRun{}, err
	}
	s.publishReviewEvent(ctx, "shot.evaluation.created", shotExecution.OrgID, shotExecution.ProjectID, "evaluation_run", record.ID, map[string]any{
		"shot_execution_id":   record.ShotExecutionID,
		"evaluation_run_id":   record.ID,
		"status":              record.Status,
		"failed_checks_count": len(record.FailedChecks),
	})
	return record, nil
}

func (s *Service) ListEvaluationRuns(_ context.Context, input ListEvaluationRunsInput) ([]review.EvaluationRun, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("reviewapp: repository is required")
	}
	return s.repo.ListEvaluationRunsByExecution(input.ShotExecutionID), nil
}

func (s *Service) ListShotReviews(_ context.Context, input ListShotReviewsInput) ([]review.ShotReview, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("reviewapp: repository is required")
	}
	return s.repo.ListReviewsByExecution(input.ShotExecutionID), nil
}

func (s *Service) GetShotReviewSummary(ctx context.Context, input GetShotReviewSummaryInput) (ShotReviewSummary, error) {
	reviews, err := s.ListShotReviews(ctx, ListShotReviewsInput{
		ShotExecutionID: input.ShotExecutionID,
	})
	if err != nil {
		return ShotReviewSummary{}, err
	}
	if len(reviews) == 0 {
		return ShotReviewSummary{
			ShotExecutionID: input.ShotExecutionID,
		}, nil
	}

	lastReview := reviews[len(reviews)-1]
	return ShotReviewSummary{
		ShotExecutionID:  input.ShotExecutionID,
		LatestConclusion: lastReview.Conclusion,
		LatestReviewID:   lastReview.ID,
	}, nil
}

func (s *Service) publishReviewEvent(ctx context.Context, eventType string, organizationID string, projectID string, resourceType string, resourceID string, payload map[string]any) {
	if s == nil || s.eventPublisher == nil {
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	s.eventPublisher.PublishWithContext(ctx, events.Event{
		EventType:      eventType,
		OrganizationID: organizationID,
		ProjectID:      projectID,
		ResourceType:   resourceType,
		ResourceID:     resourceID,
		Payload:        string(body),
	})
}
