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
	MediaType     string
	SourceType    string
	Locale        string
	RightsStatus  string
	ConsentStatus string
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
	ID            string
	OrgID         string
	ProjectID     string
	ImportBatchID string
	FileName      string
	Checksum      string
	SizeBytes     int64
	RetryCount    int
	Status        string
	ResumeHint    string
	CreatedAt     time.Time
	ExpiresAt     time.Time
	LastRetryAt   time.Time
}

type UploadFile struct {
	ID              string
	UploadSessionID string
	FileName        string
	MimeType        string
	Checksum        string
	SizeBytes       int64
	CreatedAt       time.Time
}

type MediaAssetVariant struct {
	ID           string
	AssetID      string
	UploadFileID string
	VariantType  string
	MimeType     string
	Width        int
	Height       int
	DurationMS   int
	CreatedAt    time.Time
}

type ImportBatchUpdatedEventPayload struct {
	ImportBatchID    string `json:"import_batch_id"`
	Status           string `json:"status"`
	Reason           string `json:"reason"`
	CandidateAssetID string `json:"candidate_asset_id,omitempty"`
	UploadSessionID  string `json:"upload_session_id,omitempty"`
	OrganizationID   string `json:"organization_id"`
	ProjectID        string `json:"project_id"`
}
