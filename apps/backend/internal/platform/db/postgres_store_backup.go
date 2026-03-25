package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/gateway"
)

const backupPackageStoreKeyPrefix = "backup_package:"

func backupPackageStoreKey(packageID string) string {
	return backupPackageStoreKeyPrefix + strings.TrimSpace(packageID)
}

func backupPackageIDFromStoreKey(storeKey string) string {
	return strings.TrimPrefix(strings.TrimSpace(storeKey), backupPackageStoreKeyPrefix)
}

func (s *PostgresStore) CreateBackupPackage(ctx context.Context, createdByUserID string) (BackupPackageRecord, error) {
	snapshot, err := s.LoadCurrentBackupSnapshot(ctx)
	if err != nil {
		return BackupPackageRecord{}, err
	}
	metadata, err := newBackupPackageMetadata(snapshot, strings.TrimSpace(createdByUserID), time.Now().UTC())
	if err != nil {
		return BackupPackageRecord{}, err
	}
	record := BackupPackageRecord{
		Metadata: metadata,
		Snapshot: snapshot,
	}
	payload, err := json.Marshal(record)
	if err != nil {
		return BackupPackageRecord{}, fmt.Errorf("db: encode backup package %s: %w", metadata.PackageID, err)
	}
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO app_state_snapshots (store_key, payload, updated_at)
		VALUES ($1, $2::jsonb, $3)
		ON CONFLICT (store_key)
		DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
	`, backupPackageStoreKey(metadata.PackageID), string(payload), metadata.CreatedAt); err != nil {
		return BackupPackageRecord{}, fmt.Errorf("db: save backup package %s: %w", metadata.PackageID, err)
	}
	return record, nil
}

func (s *PostgresStore) ListBackupPackages(ctx context.Context) ([]BackupPackageMetadata, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT store_key, payload::text
		FROM app_state_snapshots
		WHERE store_key LIKE $1
		ORDER BY updated_at DESC, store_key DESC
	`, backupPackageStoreKeyPrefix+"%")
	if err != nil {
		return nil, fmt.Errorf("db: list backup packages: %w", err)
	}
	defer rows.Close()

	items := make([]BackupPackageMetadata, 0)
	for rows.Next() {
		var (
			storeKey string
			payload  string
		)
		if err := rows.Scan(&storeKey, &payload); err != nil {
			return nil, fmt.Errorf("db: scan backup package row: %w", err)
		}
		record, err := decodeBackupPackageRecord(storeKey, payload)
		if err != nil {
			return nil, err
		}
		items = append(items, record.Metadata)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("db: iterate backup packages: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) GetBackupPackage(ctx context.Context, packageID string) (BackupPackageRecord, bool, error) {
	key := backupPackageStoreKey(packageID)
	var payload string
	err := s.db.QueryRowContext(ctx, `
		SELECT payload::text
		FROM app_state_snapshots
		WHERE store_key = $1
	`, key).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return BackupPackageRecord{}, false, nil
	}
	if err != nil {
		return BackupPackageRecord{}, false, fmt.Errorf("db: get backup package %s: %w", strings.TrimSpace(packageID), err)
	}
	record, err := decodeBackupPackageRecord(key, payload)
	if err != nil {
		return BackupPackageRecord{}, false, err
	}
	return record, true, nil
}

func (s *PostgresStore) LoadCurrentBackupSnapshot(ctx context.Context) (Snapshot, error) {
	persister := NewPostgresPersister(s.db, s.storeKey)
	snapshot, err := persister.Load(ctx)
	if err != nil {
		return Snapshot{}, err
	}
	gatewayResults, err := s.loadGatewayResults(ctx)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot.GatewayResults = gatewayResults
	return *snapshot, nil
}

func (s *PostgresStore) ApplyBackupPackage(ctx context.Context, packageID string) (BackupPackageRecord, error) {
	record, ok, err := s.GetBackupPackage(ctx, packageID)
	if err != nil {
		return BackupPackageRecord{}, err
	}
	if !ok {
		return BackupPackageRecord{}, fmt.Errorf("db: backup package %s not found", strings.TrimSpace(packageID))
	}

	restoreSnapshot := record.Snapshot
	restoreSnapshot.GatewayResults = map[string]gateway.GatewayResult{}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return BackupPackageRecord{}, fmt.Errorf("db: begin backup restore tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	persister := NewPostgresPersister(s.db, s.storeKey)
	if err := persister.saveRelationalSnapshot(ctx, tx, restoreSnapshot); err != nil {
		return BackupPackageRecord{}, err
	}
	if err := clearGatewaySnapshotNamespacesTx(ctx, tx); err != nil {
		return BackupPackageRecord{}, err
	}
	if err := persister.saveFallbackSnapshotTx(ctx, tx, extractFallbackSnapshot(restoreSnapshot)); err != nil {
		return BackupPackageRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return BackupPackageRecord{}, fmt.Errorf("db: commit backup restore tx: %w", err)
	}
	return record, nil
}

func (s *PostgresStore) loadGatewayResults(ctx context.Context) (map[string]gateway.GatewayResult, error) {
	var payload sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT payload::text
		FROM app_state_snapshots
		WHERE store_key = $1
	`, s.gatewaySnapshotKey).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) || !payload.Valid || strings.TrimSpace(payload.String) == "" {
		return map[string]gateway.GatewayResult{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: load gateway results snapshot: %w", err)
	}

	items := make(map[string]gateway.GatewayResult)
	if err := json.Unmarshal([]byte(payload.String), &items); err != nil {
		return nil, fmt.Errorf("db: decode gateway results snapshot: %w", err)
	}
	return items, nil
}

func clearGatewaySnapshotNamespacesTx(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM app_state_snapshots
		WHERE store_key = $1 OR store_key LIKE $2
	`, defaultGatewaySnapshotStoreKey, defaultGatewaySnapshotStoreKey+":%"); err != nil {
		return fmt.Errorf("db: clear gateway result snapshots: %w", err)
	}
	return nil
}

func decodeBackupPackageRecord(storeKey string, payload string) (BackupPackageRecord, error) {
	record := BackupPackageRecord{}
	if err := json.Unmarshal([]byte(payload), &record); err != nil {
		return BackupPackageRecord{}, fmt.Errorf("db: decode backup package %s: %w", backupPackageIDFromStoreKey(storeKey), err)
	}
	if strings.TrimSpace(record.Metadata.PackageID) == "" {
		record.Metadata.PackageID = backupPackageIDFromStoreKey(storeKey)
	}
	if record.Metadata.Counts == nil {
		record.Metadata.Counts = map[string]int{}
	}
	return record, nil
}

func newBackupPackageMetadata(snapshot Snapshot, createdByUserID string, createdAt time.Time) (BackupPackageMetadata, error) {
	summary, err := SummarizeBackupSnapshot(snapshot)
	if err != nil {
		return BackupPackageMetadata{}, err
	}
	metadata := BackupPackageMetadata{
		PackageID:       uuid.NewString(),
		SchemaVersion:   BackupPackageSchemaVersionV1,
		RestoreMode:     BackupPackageRestoreModeFullRuntime,
		CreatedAt:       createdAt.UTC(),
		CreatedByUserID: strings.TrimSpace(createdByUserID),
		OrgIDs:          summary.OrgIDs,
		ProjectIDs:      summary.ProjectIDs,
		Counts:          summary.Counts,
		PayloadBytes:    summary.PayloadBytes,
	}
	return metadata, nil
}

func SummarizeBackupSnapshot(snapshot Snapshot) (BackupSummary, error) {
	counts := backupPackageCounts(snapshot)
	summary := BackupSummary{
		OrgIDs:     sortedStringKeys(snapshot.Organizations),
		ProjectIDs: sortedStringKeys(snapshot.Projects),
		Counts:     counts,
	}
	payloadBytes, err := calculateBackupPayloadBytes(snapshot, BackupPackageMetadata{
		PackageID:     "summary",
		SchemaVersion: BackupPackageSchemaVersionV1,
		RestoreMode:   BackupPackageRestoreModeFullRuntime,
		OrgIDs:        summary.OrgIDs,
		ProjectIDs:    summary.ProjectIDs,
		Counts:        counts,
	})
	if err != nil {
		return BackupSummary{}, err
	}
	summary.PayloadBytes = payloadBytes
	return summary, nil
}

func calculateBackupPayloadBytes(snapshot Snapshot, metadata BackupPackageMetadata) (int64, error) {
	current := metadata
	for iteration := 0; iteration < 8; iteration++ {
		payload, err := json.Marshal(BackupPackageRecord{
			Metadata: current,
			Snapshot: snapshot,
		})
		if err != nil {
			return 0, fmt.Errorf("db: encode backup package payload bytes: %w", err)
		}
		next := int64(len(payload))
		if current.PayloadBytes == next {
			return next, nil
		}
		current.PayloadBytes = next
	}
	return current.PayloadBytes, nil
}

func backupPackageCounts(snapshot Snapshot) map[string]int {
	rolePermissionCount := 0
	for _, permissions := range snapshot.RolePermissions {
		rolePermissionCount += len(permissions)
	}
	return map[string]int{
		"organizations":           len(snapshot.Organizations),
		"users":                   len(snapshot.Users),
		"roles":                   len(snapshot.Roles),
		"memberships":             len(snapshot.Memberships),
		"role_permissions":        rolePermissionCount,
		"projects":                len(snapshot.Projects),
		"episodes":                len(snapshot.Episodes),
		"scenes":                  len(snapshot.Scenes),
		"shots":                   len(snapshot.Shots),
		"snapshots":               len(snapshot.Snapshots),
		"collaboration_sessions":  len(snapshot.CollaborationSessions),
		"collaboration_presences": len(snapshot.CollaborationPresences),
		"preview_assemblies":      len(snapshot.PreviewAssemblies),
		"preview_assembly_items":  len(snapshot.PreviewAssemblyItems),
		"preview_runtimes":        len(snapshot.PreviewRuntimes),
		"audio_runtimes":          len(snapshot.AudioRuntimes),
		"audio_timelines":         len(snapshot.AudioTimelines),
		"audio_tracks":            len(snapshot.AudioTracks),
		"audio_clips":             len(snapshot.AudioClips),
		"shot_executions":         len(snapshot.ShotExecutions),
		"shot_execution_runs":     len(snapshot.ShotExecutionRuns),
		"import_batches":          len(snapshot.ImportBatches),
		"import_batch_items":      len(snapshot.ImportBatchItems),
		"upload_sessions":         len(snapshot.UploadSessions),
		"upload_files":            len(snapshot.UploadFiles),
		"media_assets":            len(snapshot.MediaAssets),
		"media_asset_variants":    len(snapshot.MediaAssetVariants),
		"candidate_assets":        len(snapshot.CandidateAssets),
		"reviews":                 len(snapshot.Reviews),
		"evaluation_runs":         len(snapshot.EvaluationRuns),
		"budgets":                 len(snapshot.Budgets),
		"usage_records":           len(snapshot.UsageRecords),
		"billing_events":          len(snapshot.BillingEvents),
		"workflow_runs":           len(snapshot.WorkflowRuns),
		"workflow_steps":          len(snapshot.WorkflowSteps),
		"jobs":                    len(snapshot.Jobs),
		"state_transitions":       len(snapshot.StateTransitions),
		"gateway_results":         len(snapshot.GatewayResults),
	}
}

func sortedStringKeys[T any](records map[string]T) []string {
	if len(records) == 0 {
		return []string{}
	}
	items := make([]string, 0, len(records))
	for id := range records {
		items = append(items, id)
	}
	sort.Strings(items)
	return items
}
