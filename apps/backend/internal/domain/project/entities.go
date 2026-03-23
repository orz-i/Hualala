package project

import "time"

type Project struct {
	ID                      string
	OrganizationID          string
	OwnerUserID             string
	Title                   string
	Status                  string
	CurrentStage            string
	PrimaryContentLocale    string
	SupportedContentLocales []string
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

type Episode struct {
	ID        string
	ProjectID string
	EpisodeNo int
	Title     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type PreviewAssembly struct {
	ID        string
	ProjectID string
	EpisodeID string
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type PreviewAssemblyItem struct {
	ID             string
	AssemblyID     string
	ShotID         string
	PrimaryAssetID string
	SourceRunID    string
	Sequence       int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type AudioTimeline struct {
	ID                  string
	ProjectID           string
	EpisodeID           string
	Status              string
	RenderWorkflowRunID string
	RenderStatus        string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type AudioTrack struct {
	ID            string
	TimelineID    string
	TrackType     string
	DisplayName   string
	Sequence      int
	Muted         bool
	Solo          bool
	VolumePercent int
	Clips         []AudioClip
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type AudioClip struct {
	ID          string
	TrackID     string
	AssetID     string
	SourceRunID string
	Sequence    int
	StartMs     int
	DurationMs  int
	TrimInMs    int
	TrimOutMs   int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
