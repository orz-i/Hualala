package review

import "time"

type ShotReview struct {
	ID              string
	ShotExecutionID string
	Conclusion      string
	CommentLocale   string
	Comment         string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type EvaluationRun struct {
	ID              string
	ShotExecutionID string
	PassedChecks    []string
	FailedChecks    []string
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
