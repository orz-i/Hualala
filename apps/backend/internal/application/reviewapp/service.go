package reviewapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
}

type CreateShotReviewInput struct {
	ShotExecutionID string
	Conclusion      string
	CommentLocale   string
	Comment         string
}

type CreateEvaluationRunInput struct {
	ShotExecutionID string
	PassedChecks    []string
	FailedChecks    []string
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) CreateShotReview(_ context.Context, input CreateShotReviewInput) (review.ShotReview, error) {
	if s == nil || s.store == nil {
		return review.ShotReview{}, errors.New("reviewapp: store is required")
	}
	if _, ok := s.store.ShotExecutions[input.ShotExecutionID]; !ok {
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
		ID:              s.store.NextReviewID(),
		ShotExecutionID: strings.TrimSpace(input.ShotExecutionID),
		Conclusion:      strings.TrimSpace(input.Conclusion),
		CommentLocale:   strings.TrimSpace(input.CommentLocale),
		Comment:         strings.TrimSpace(input.Comment),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	s.store.Reviews[record.ID] = record
	return record, nil
}

func (s *Service) CreateEvaluationRun(_ context.Context, input CreateEvaluationRunInput) (review.EvaluationRun, error) {
	if s == nil || s.store == nil {
		return review.EvaluationRun{}, errors.New("reviewapp: store is required")
	}
	if _, ok := s.store.ShotExecutions[input.ShotExecutionID]; !ok {
		return review.EvaluationRun{}, errors.New("reviewapp: shot execution not found")
	}

	now := time.Now().UTC()
	record := review.EvaluationRun{
		ID:              s.store.NextEvaluationRunID(),
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

	s.store.EvaluationRuns[record.ID] = record
	return record, nil
}
