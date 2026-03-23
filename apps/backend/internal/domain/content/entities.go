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
	ID                 string
	OwnerType          string
	OwnerID            string
	Locale             string
	SourceSnapshotID   string
	TranslationGroupID string
	TranslationStatus  string
	Body               string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type CollaborationSession struct {
	ID               string
	OwnerType        string
	OwnerID          string
	DraftVersion     uint32
	LockHolderUserID string
	LeaseExpiresAt   time.Time
	ConflictSummary  string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type CollaborationPresence struct {
	ID             string
	SessionID      string
	UserID         string
	Status         string
	LastSeenAt     time.Time
	LeaseExpiresAt time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
