package asset

import "time"

type ImportBatch struct {
	ID         string
	OrgID      string
	ProjectID  string
	OperatorID string
	SourceType string
	Status     string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type MediaAsset struct {
	ID            string
	OrgID         string
	ProjectID     string
	ImportBatchID string
	SourceType    string
	Locale        string
	RightsStatus  string
	AIAnnotated   bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type CandidateAsset struct {
	ID              string
	ShotExecutionID string
	AssetID         string
	SourceRunID     string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ImportBatchItem struct {
	ID            string
	ImportBatchID string
	Status        string
	MatchedShotID string
	AssetID       string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type UploadSession struct {
	ID          string
	OrgID       string
	ProjectID   string
	FileName    string
	Checksum    string
	SizeBytes   int64
	RetryCount  int
	Status      string
	ResumeHint  string
	CreatedAt   time.Time
	ExpiresAt   time.Time
	LastRetryAt time.Time
}
