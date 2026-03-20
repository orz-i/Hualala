package billing

import "time"

type ProjectBudget struct {
	ID            string
	OrgID         string
	ProjectID     string
	LimitCents    int64
	ReservedCents int64
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type UsageRecord struct {
	ID                 string
	OrgID              string
	ProjectID          string
	ShotExecutionID    string
	ShotExecutionRunID string
	Meter              string
	AmountCents        int64
	CreatedAt          time.Time
}

type BillingEvent struct {
	ID                 string
	OrgID              string
	ProjectID          string
	ShotExecutionID    string
	ShotExecutionRunID string
	EventType          string
	AmountCents        int64
	CreatedAt          time.Time
}
