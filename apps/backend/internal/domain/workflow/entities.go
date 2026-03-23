package workflow

import "time"

const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusFailed    = "failed"
	StatusCompleted = "completed"
	StatusCancelled = "cancelled"

	ResourceTypeWorkflowRun = "workflow_run"
	JobTypeWorkflowDispatch = "workflow.dispatch"
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

type Job struct {
	ID           string
	OrgID        string
	ProjectID    string
	ResourceType string
	ResourceID   string
	JobType      string
	Status       string
	Priority     int
	Payload      string
	ScheduledAt  time.Time
	StartedAt    time.Time
	CompletedAt  time.Time
	FailedAt     time.Time
	ErrorCode    string
	ErrorMessage string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type StateTransition struct {
	ID           string
	OrgID        string
	ProjectID    string
	ResourceType string
	ResourceID   string
	FromState    string
	ToState      string
	Reason       string
	CreatedAt    time.Time
}
