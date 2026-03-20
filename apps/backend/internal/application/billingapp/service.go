package billingapp

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	repo           db.ReviewBillingRepository
	eventPublisher *events.Publisher
}

type SetProjectBudgetInput struct {
	ProjectID  string `json:"project_id"`
	OrgID      string `json:"org_id"`
	LimitCents int64  `json:"limit_cents"`
}

type GetBudgetSnapshotInput struct {
	ProjectID string
}

type ListUsageRecordsInput struct {
	ProjectID string
}

type ListBillingEventsInput struct {
	ProjectID string
}

type BudgetSnapshot struct {
	ProjectID            string
	LimitCents           int64
	ReservedCents        int64
	RemainingBudgetCents int64
}

func NewService(repo db.ReviewBillingRepository, eventPublisher *events.Publisher) *Service {
	return &Service{repo: repo, eventPublisher: eventPublisher}
}

func (s *Service) SetProjectBudget(ctx context.Context, input SetProjectBudgetInput) (billing.ProjectBudget, error) {
	if s == nil || s.repo == nil {
		return billing.ProjectBudget{}, errors.New("billingapp: repository is required")
	}
	if strings.TrimSpace(input.ProjectID) == "" {
		return billing.ProjectBudget{}, errors.New("billingapp: project_id is required")
	}
	if strings.TrimSpace(input.OrgID) == "" {
		return billing.ProjectBudget{}, errors.New("billingapp: org_id is required")
	}
	if input.LimitCents <= 0 {
		return billing.ProjectBudget{}, errors.New("billingapp: limit_cents must be greater than 0")
	}

	now := time.Now().UTC()
	projectID := strings.TrimSpace(input.ProjectID)
	orgID := strings.TrimSpace(input.OrgID)
	if record, ok := s.repo.GetBudgetByProject(projectID); ok {
		record.OrgID = orgID
		record.LimitCents = input.LimitCents
		record.UpdatedAt = now
		if err := s.repo.SaveBudget(ctx, record); err != nil {
			return billing.ProjectBudget{}, err
		}
		s.publishBudgetUpdated(record)
		return record, nil
	}

	record := billing.ProjectBudget{
		ID:         s.repo.GenerateBudgetID(),
		OrgID:      orgID,
		ProjectID:  projectID,
		LimitCents: input.LimitCents,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.repo.SaveBudget(ctx, record); err != nil {
		return billing.ProjectBudget{}, err
	}
	s.publishBudgetUpdated(record)
	return record, nil
}

func (s *Service) GetBudgetSnapshot(_ context.Context, input GetBudgetSnapshotInput) (BudgetSnapshot, error) {
	if s == nil || s.repo == nil {
		return BudgetSnapshot{}, errors.New("billingapp: repository is required")
	}
	if record, ok := s.repo.GetBudgetByProject(strings.TrimSpace(input.ProjectID)); ok {
		return BudgetSnapshot{
			ProjectID:            record.ProjectID,
			LimitCents:           record.LimitCents,
			ReservedCents:        record.ReservedCents,
			RemainingBudgetCents: record.LimitCents - record.ReservedCents,
		}, nil
	}

	return BudgetSnapshot{
		ProjectID: input.ProjectID,
	}, nil
}

func (s *Service) ListUsageRecords(_ context.Context, input ListUsageRecordsInput) ([]billing.UsageRecord, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("billingapp: repository is required")
	}
	return s.repo.ListUsageRecordsByProject(strings.TrimSpace(input.ProjectID)), nil
}

func (s *Service) ListBillingEvents(_ context.Context, input ListBillingEventsInput) ([]billing.BillingEvent, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("billingapp: repository is required")
	}
	return s.repo.ListBillingEventsByProject(strings.TrimSpace(input.ProjectID)), nil
}

func (s *Service) publishBudgetUpdated(record billing.ProjectBudget) {
	if s == nil || s.eventPublisher == nil {
		return
	}
	payload, err := json.Marshal(map[string]any{
		"project_id":      record.ProjectID,
		"amount_cents":    record.LimitCents,
		"limit_cents":     record.LimitCents,
		"reserved_cents":  record.ReservedCents,
		"remaining_cents": record.LimitCents - record.ReservedCents,
	})
	if err != nil {
		return
	}
	s.eventPublisher.Publish(events.Event{
		EventType:      "budget.updated",
		OrganizationID: record.OrgID,
		ProjectID:      record.ProjectID,
		ResourceType:   "budget",
		ResourceID:     record.ID,
		Payload:        string(payload),
	})
}
