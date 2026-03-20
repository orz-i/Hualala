package content

import "time"

type Scene struct {
	ID           string
	ProjectID    string
	EpisodeID    string
	SceneNo      int
	Code         string
	Title        string
	SourceLocale string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Shot struct {
	ID           string
	SceneID      string
	ShotNo       int
	Code         string
	Title        string
	SourceLocale string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Snapshot struct {
	ID                string
	OwnerType         string
	OwnerID           string
	Locale            string
	SourceSnapshotID  string
	TranslationGroupID string
	TranslationStatus string
	Body              string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}
