package workflow

import "time"

const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusFailed    = "failed"
	StatusCompleted = "completed"
	StatusCancelled = "cancelled"
)

type WorkflowRun struct {
	ID                string
	OrgID             string
	ProjectID         string
	WorkflowType      string
	ResourceID        string
	Status            string
	LastError         string
	CurrentStep       string
	AttemptCount      int
	Provider          string
	IdempotencyKey    string
	ExternalRequestID string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type WorkflowStep struct {
	ID            string
	WorkflowRunID string
	StepKey       string
	StepOrder     int
	Status        string
	ErrorCode     string
	ErrorMessage  string
	StartedAt     time.Time
	CompletedAt   time.Time
	FailedAt      time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
