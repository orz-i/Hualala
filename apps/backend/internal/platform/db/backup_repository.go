package db

import (
	"context"
	"time"
)

const (
	BackupPackageSchemaVersionV1        = "backup_v1"
	BackupPackageRestoreModeFullRuntime = "full_runtime_replace"
)

type BackupPackageMetadata struct {
	PackageID       string         `json:"packageId"`
	SchemaVersion   string         `json:"schemaVersion"`
	RestoreMode     string         `json:"restoreMode"`
	CreatedAt       time.Time      `json:"createdAt"`
	CreatedByUserID string         `json:"createdByUserId"`
	OrgIDs          []string       `json:"orgIds"`
	ProjectIDs      []string       `json:"projectIds"`
	Counts          map[string]int `json:"counts"`
	PayloadBytes    int64          `json:"payloadBytes"`
}

type BackupSummary struct {
	OrgIDs       []string       `json:"orgIds"`
	ProjectIDs   []string       `json:"projectIds"`
	Counts       map[string]int `json:"counts"`
	PayloadBytes int64          `json:"payloadBytes"`
}

type BackupPackageRecord struct {
	Metadata BackupPackageMetadata `json:"metadata"`
	Snapshot Snapshot              `json:"snapshot"`
}

type BackupRepository interface {
	CreateBackupPackage(ctx context.Context, createdByUserID string) (BackupPackageRecord, error)
	ListBackupPackages(ctx context.Context) ([]BackupPackageMetadata, error)
	GetBackupPackage(ctx context.Context, packageID string) (BackupPackageRecord, bool, error)
	LoadCurrentBackupSnapshot(ctx context.Context) (Snapshot, error)
	ApplyBackupPackage(ctx context.Context, packageID string) (BackupPackageRecord, error)
}
