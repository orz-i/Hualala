package execution

import "time"

type ShotExecution struct {
	ID             string
	OrgID          string
	ProjectID      string
	ShotID         string
	Status         string
	PrimaryAssetID string
	CurrentRunID   string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type ShotExecutionRun struct {
	ID              string
	ShotExecutionID string
	RunNumber       int
	Status          string
	TriggerType     string
	OperatorID      string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type SubmissionGateResult struct {
	PassedChecks []string
	FailedChecks []string
}
