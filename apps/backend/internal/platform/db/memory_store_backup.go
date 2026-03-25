package db

import (
	"context"
	"errors"
)

func errBackupUnavailable() error {
	return errors.New("db: failed precondition: backup restore requires postgres runtime")
}

func (*MemoryStore) CreateBackupPackage(context.Context, string) (BackupPackageRecord, error) {
	return BackupPackageRecord{}, errBackupUnavailable()
}

func (*MemoryStore) ListBackupPackages(context.Context) ([]BackupPackageMetadata, error) {
	return nil, errBackupUnavailable()
}

func (*MemoryStore) GetBackupPackage(context.Context, string) (BackupPackageRecord, bool, error) {
	return BackupPackageRecord{}, false, errBackupUnavailable()
}

func (*MemoryStore) LoadCurrentBackupSnapshot(context.Context) (Snapshot, error) {
	return Snapshot{}, errBackupUnavailable()
}

func (*MemoryStore) ApplyBackupPackage(context.Context, string) (BackupPackageRecord, error) {
	return BackupPackageRecord{}, errBackupUnavailable()
}
