package billingapp

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type Service struct {
	store *db.MemoryStore
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

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) SetProjectBudget(ctx context.Context, input SetProjectBudgetInput) (billing.ProjectBudget, error) {
	if s == nil || s.store == nil {
		return billing.ProjectBudget{}, errors.New("billingapp: store is required")
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
	for id, record := range s.store.Budgets {
		if record.ProjectID == strings.TrimSpace(input.ProjectID) {
			record.OrgID = strings.TrimSpace(input.OrgID)
			record.LimitCents = input.LimitCents
			record.UpdatedAt = now
			s.store.Budgets[id] = record
			if err := s.store.Persist(ctx); err != nil {
				return billing.ProjectBudget{}, err
			}
			s.publishBudgetUpdated(record)
			return record, nil
		}
	}

	record := billing.ProjectBudget{
		ID:         s.store.NextBudgetID(),
		OrgID:      strings.TrimSpace(input.OrgID),
		ProjectID:  strings.TrimSpace(input.ProjectID),
		LimitCents: input.LimitCents,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	s.store.Budgets[record.ID] = record
	if err := s.store.Persist(ctx); err != nil {
		return billing.ProjectBudget{}, err
	}
	s.publishBudgetUpdated(record)
	return record, nil
}

func (s *Service) GetBudgetSnapshot(_ context.Context, input GetBudgetSnapshotInput) (BudgetSnapshot, error) {
	for _, record := range s.store.Budgets {
		if record.ProjectID == strings.TrimSpace(input.ProjectID) {
			return BudgetSnapshot{
				ProjectID:            record.ProjectID,
				LimitCents:           record.LimitCents,
				ReservedCents:        record.ReservedCents,
				RemainingBudgetCents: record.LimitCents - record.ReservedCents,
			}, nil
		}
	}

	return BudgetSnapshot{
		ProjectID: input.ProjectID,
	}, nil
}

func (s *Service) ListUsageRecords(_ context.Context, input ListUsageRecordsInput) ([]billing.UsageRecord, error) {
	records := make([]billing.UsageRecord, 0)
	for _, record := range s.store.UsageRecords {
		if record.ProjectID == strings.TrimSpace(input.ProjectID) {
			records = append(records, record)
		}
	}

	sort.Slice(records, func(i, j int) bool {
		return records[i].ID < records[j].ID
	})

	return records, nil
}

func (s *Service) ListBillingEvents(_ context.Context, input ListBillingEventsInput) ([]billing.BillingEvent, error) {
	events := make([]billing.BillingEvent, 0)
	for _, event := range s.store.BillingEvents {
		if event.ProjectID == strings.TrimSpace(input.ProjectID) {
			events = append(events, event)
		}
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].ID < events[j].ID
	})

	return events, nil
}

func (s *Service) publishBudgetUpdated(record billing.ProjectBudget) {
	if s == nil || s.store == nil || s.store.EventPublisher == nil {
		return
	}
	payload, err := json.Marshal(map[string]any{
		"project_id":      record.ProjectID,
		"limit_cents":     record.LimitCents,
		"reserved_cents":  record.ReservedCents,
		"remaining_cents": record.LimitCents - record.ReservedCents,
	})
	if err != nil {
		return
	}
	s.store.EventPublisher.Publish(events.Event{
		EventType:      "budget.updated",
		OrganizationID: record.OrgID,
		ProjectID:      record.ProjectID,
		ResourceType:   "budget",
		ResourceID:     record.ID,
		Payload:        string(payload),
	})
}
