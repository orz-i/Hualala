package billingapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
}

type SetProjectBudgetInput struct {
	ProjectID  string
	OrgID      string
	LimitCents int64
}

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) SetProjectBudget(_ context.Context, input SetProjectBudgetInput) (billing.ProjectBudget, error) {
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
	return record, nil
}
