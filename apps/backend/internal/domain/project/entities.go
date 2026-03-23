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
