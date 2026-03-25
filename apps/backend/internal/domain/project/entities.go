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

type PreviewRuntime struct {
	ID                  string
	ProjectID           string
	EpisodeID           string
	AssemblyID          string
	Status              string
	RenderWorkflowRunID string
	RenderStatus        string
	PlaybackAssetID     string
	ExportAssetID       string
	ResolvedLocale      string
	Playback            PreviewPlaybackDelivery
	ExportOutput        PreviewExportDelivery
	LastErrorCode       string
	LastErrorMessage    string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type PreviewPlaybackDelivery struct {
	DeliveryMode string
	PlaybackURL  string
	PosterURL    string
	DurationMs   int
	Timeline     PreviewTimelineSpine
}

type PreviewExportDelivery struct {
	DownloadURL string
	MimeType    string
	FileName    string
	SizeBytes   int64
}

type PreviewTimelineSpine struct {
	Segments        []PreviewTimelineSegment
	TotalDurationMs int
}

type PreviewTimelineSegment struct {
	SegmentID        string
	Sequence         int
	ShotID           string
	ShotCode         string
	ShotTitle        string
	PlaybackAssetID  string
	SourceRunID      string
	StartMs          int
	DurationMs       int
	TransitionToNext *PreviewTransition
}

type PreviewTransition struct {
	TransitionType string
	DurationMs     int
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

type AudioRuntime struct {
	ID                  string
	ProjectID           string
	EpisodeID           string
	AudioTimelineID     string
	Status              string
	RenderWorkflowRunID string
	RenderStatus        string
	MixAssetID          string
	MixOutput           AudioMixDelivery
	Waveforms           []AudioWaveformReference
	LastErrorCode       string
	LastErrorMessage    string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type AudioMixDelivery struct {
	DeliveryMode string
	PlaybackURL  string
	DownloadURL  string
	MimeType     string
	FileName     string
	SizeBytes    int64
	DurationMs   int
}

type AudioWaveformReference struct {
	AssetID     string
	VariantID   string
	WaveformURL string
	MimeType    string
	DurationMs  int
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
