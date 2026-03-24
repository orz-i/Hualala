package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/lib/pq"
)

func (s *PostgresStore) SaveShotExecution(ctx context.Context, record execution.ShotExecution) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shot_executions (
			id, organization_id, project_id, shot_id, status, current_run_id, primary_asset_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    shot_id = EXCLUDED.shot_id,
		    status = EXCLUDED.status,
		    current_run_id = EXCLUDED.current_run_id,
		    primary_asset_id = EXCLUDED.primary_asset_id,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OrgID, record.ProjectID, record.ShotID, defaultString(record.Status, "pending"), nullableUUID(record.CurrentRunID), nullableUUID(record.PrimaryAssetID), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert shot execution %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetShotExecution(shotExecutionID string) (execution.ShotExecution, bool) {
	if s == nil || s.db == nil {
		return execution.ShotExecution{}, false
	}
	record := execution.ShotExecution{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, shot_id::text, status,
		       COALESCE(primary_asset_id::text, ''), COALESCE(current_run_id::text, ''), created_at, updated_at
		FROM shot_executions
		WHERE id = $1
	`, strings.TrimSpace(shotExecutionID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.ProjectID,
		&record.ShotID,
		&record.Status,
		&record.PrimaryAssetID,
		&record.CurrentRunID,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return execution.ShotExecution{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) FindShotExecutionByShotID(shotID string) (execution.ShotExecution, bool) {
	if s == nil || s.db == nil {
		return execution.ShotExecution{}, false
	}
	record := execution.ShotExecution{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, shot_id::text, status,
		       COALESCE(primary_asset_id::text, ''), COALESCE(current_run_id::text, ''), created_at, updated_at
		FROM shot_executions
		WHERE shot_id = $1
		ORDER BY id
		LIMIT 1
	`, strings.TrimSpace(shotID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.ProjectID,
		&record.ShotID,
		&record.Status,
		&record.PrimaryAssetID,
		&record.CurrentRunID,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return execution.ShotExecution{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListShotExecutionsByShotIDs(shotIDs []string) []execution.ShotExecution {
	if s == nil || s.db == nil || len(shotIDs) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, shot_id::text, status,
		       COALESCE(primary_asset_id::text, ''), COALESCE(current_run_id::text, ''), created_at, updated_at
		FROM shot_executions
		WHERE shot_id = ANY($1::uuid[])
		ORDER BY shot_id ASC, id ASC
	`, pqStringUUIDArray(shotIDs))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]execution.ShotExecution, 0)
	for rows.Next() {
		var record execution.ShotExecution
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ShotID, &record.Status, &record.PrimaryAssetID, &record.CurrentRunID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListShotExecutionsByIDs(ids []string) []execution.ShotExecution {
	if s == nil || s.db == nil || len(ids) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, shot_id::text, status,
		       COALESCE(primary_asset_id::text, ''), COALESCE(current_run_id::text, ''), created_at, updated_at
		FROM shot_executions
		WHERE id = ANY($1::uuid[])
		ORDER BY id ASC
	`, pqStringUUIDArray(ids))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]execution.ShotExecution, 0)
	for rows.Next() {
		var record execution.ShotExecution
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ShotID, &record.Status, &record.PrimaryAssetID, &record.CurrentRunID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveShotExecutionRun(ctx context.Context, record execution.ShotExecutionRun) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shot_execution_runs (
			id, shot_execution_id, run_number, run_type, status, trigger_source, created_by_user_id,
			started_at, created_at, updated_at
		) VALUES ($1, $2, $3, 'generate', $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET shot_execution_id = EXCLUDED.shot_execution_id,
		    run_number = EXCLUDED.run_number,
		    status = EXCLUDED.status,
		    trigger_source = EXCLUDED.trigger_source,
		    created_by_user_id = EXCLUDED.created_by_user_id,
		    started_at = EXCLUDED.started_at,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ShotExecutionID, record.RunNumber, defaultString(record.Status, "pending"), defaultString(record.TriggerType, "manual"), nullableUUID(record.OperatorID), record.CreatedAt, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert shot execution run %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListShotExecutionRuns(shotExecutionID string) []execution.ShotExecutionRun {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, run_number, status, trigger_source,
		       COALESCE(created_by_user_id::text, ''), created_at, updated_at
		FROM shot_execution_runs
		WHERE shot_execution_id = $1
		ORDER BY run_number ASC, id ASC
	`, strings.TrimSpace(shotExecutionID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]execution.ShotExecutionRun, 0)
	for rows.Next() {
		var record execution.ShotExecutionRun
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.RunNumber, &record.Status, &record.TriggerType, &record.OperatorID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListShotExecutionRunsByExecutionIDs(shotExecutionIDs []string) []execution.ShotExecutionRun {
	if s == nil || s.db == nil || len(shotExecutionIDs) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, run_number, status, trigger_source,
		       COALESCE(created_by_user_id::text, ''), created_at, updated_at
		FROM shot_execution_runs
		WHERE shot_execution_id = ANY($1::uuid[])
		ORDER BY shot_execution_id ASC, run_number ASC, id ASC
	`, pqStringUUIDArray(shotExecutionIDs))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]execution.ShotExecutionRun, 0)
	for rows.Next() {
		var record execution.ShotExecutionRun
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.RunNumber, &record.Status, &record.TriggerType, &record.OperatorID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveImportBatch(ctx context.Context, record asset.ImportBatch) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO import_batches (
			id, organization_id, project_id, status, source_type, created_by_user_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    status = EXCLUDED.status,
		    source_type = EXCLUDED.source_type,
		    created_by_user_id = EXCLUDED.created_by_user_id,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OrgID, record.ProjectID, defaultString(record.Status, "pending"), defaultString(record.SourceType, "upload_session"), nullableUUID(record.OperatorID), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert import batch %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetImportBatch(importBatchID string) (asset.ImportBatch, bool) {
	if s == nil || s.db == nil {
		return asset.ImportBatch{}, false
	}
	record := asset.ImportBatch{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(created_by_user_id::text, ''),
		       source_type, status, created_at, updated_at
		FROM import_batches
		WHERE id = $1
	`, strings.TrimSpace(importBatchID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.ProjectID,
		&record.OperatorID,
		&record.SourceType,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return asset.ImportBatch{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListImportBatches(projectID string, status string, sourceType string) []asset.ImportBatch {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(created_by_user_id::text, ''),
		       source_type, status, created_at, updated_at
		FROM import_batches
		WHERE ($1 = '' OR project_id::text = $1)
		  AND ($2 = '' OR status = $2)
		  AND ($3 = '' OR source_type = $3)
		ORDER BY updated_at DESC, created_at DESC, id DESC
	`, strings.TrimSpace(projectID), strings.TrimSpace(status), strings.TrimSpace(sourceType))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.ImportBatch, 0)
	for rows.Next() {
		var record asset.ImportBatch
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.OperatorID, &record.SourceType, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListImportBatchStats(importBatchIDs []string) map[string]ImportBatchStats {
	stats := make(map[string]ImportBatchStats)
	if s == nil || s.db == nil || len(importBatchIDs) == 0 {
		return stats
	}
	runStatQuery := func(query string, apply func(string, int, int)) {
		rows, err := s.db.QueryContext(context.Background(), query, pqStringUUIDArray(importBatchIDs))
		if err != nil {
			return
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			var count int
			var second int
			if err := rows.Scan(&id, &count, &second); err != nil {
				return
			}
			apply(id, count, second)
		}
	}

	runStatQuery(`
		SELECT import_batch_id::text, COUNT(*), 0
		FROM upload_sessions
		WHERE import_batch_id = ANY($1::uuid[])
		GROUP BY import_batch_id
	`, func(id string, count int, _ int) {
		record := stats[id]
		record.UploadSessionCount = count
		stats[id] = record
	})

	runStatQuery(`
		SELECT import_batch_id::text, COUNT(*), COUNT(*) FILTER (WHERE status = 'confirmed')
		FROM import_batch_items
		WHERE import_batch_id = ANY($1::uuid[])
		GROUP BY import_batch_id
	`, func(id string, count int, second int) {
		record := stats[id]
		record.ItemCount = count
		record.ConfirmedItemCount = second
		stats[id] = record
	})

	runStatQuery(`
		SELECT import_batch_id::text, COUNT(*), 0
		FROM media_assets
		WHERE import_batch_id = ANY($1::uuid[])
		GROUP BY import_batch_id
	`, func(id string, count int, _ int) {
		record := stats[id]
		record.MediaAssetCount = count
		stats[id] = record
	})

	runStatQuery(`
		SELECT media_assets.import_batch_id::text, COUNT(*), 0
		FROM shot_candidate_assets
		JOIN media_assets ON media_assets.id = shot_candidate_assets.media_asset_id
		WHERE media_assets.import_batch_id = ANY($1::uuid[])
		GROUP BY media_assets.import_batch_id
	`, func(id string, count int, _ int) {
		record := stats[id]
		record.CandidateAssetCount = count
		stats[id] = record
	})

	return stats
}

func (s *PostgresStore) SaveImportBatchItem(ctx context.Context, record asset.ImportBatchItem) error {
	uploadFileID := s.lookupUploadFileIDByAssetID(ctx, record.AssetID)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO import_batch_items (
			id, import_batch_id, upload_file_id, media_asset_id, matched_shot_id, status,
			parsed_metadata, created_at, updated_at, reviewed_at
		) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET import_batch_id = EXCLUDED.import_batch_id,
		    upload_file_id = EXCLUDED.upload_file_id,
		    media_asset_id = EXCLUDED.media_asset_id,
		    matched_shot_id = EXCLUDED.matched_shot_id,
		    status = EXCLUDED.status,
		    updated_at = EXCLUDED.updated_at,
		    reviewed_at = EXCLUDED.reviewed_at
	`, record.ID, record.ImportBatchID, nullableUUID(uploadFileID), nullableUUID(record.AssetID), nullableUUID(record.MatchedShotID), defaultString(record.Status, "parsed"), record.CreatedAt, record.UpdatedAt, nullableTime(reviewedAtForItem(record)))
	if err != nil {
		return fmt.Errorf("db: upsert import batch item %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetImportBatchItem(itemID string) (asset.ImportBatchItem, bool) {
	if s == nil || s.db == nil {
		return asset.ImportBatchItem{}, false
	}
	record := asset.ImportBatchItem{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, import_batch_id::text, status,
		       COALESCE(matched_shot_id::text, ''), COALESCE(media_asset_id::text, ''), created_at, updated_at
		FROM import_batch_items
		WHERE id = $1
	`, strings.TrimSpace(itemID)).Scan(&record.ID, &record.ImportBatchID, &record.Status, &record.MatchedShotID, &record.AssetID, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return asset.ImportBatchItem{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListImportBatchItems(importBatchID string) []asset.ImportBatchItem {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, import_batch_id::text, status,
		       COALESCE(matched_shot_id::text, ''), COALESCE(media_asset_id::text, ''), created_at, updated_at
		FROM import_batch_items
		WHERE import_batch_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(importBatchID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.ImportBatchItem, 0)
	for rows.Next() {
		var record asset.ImportBatchItem
		if err := rows.Scan(&record.ID, &record.ImportBatchID, &record.Status, &record.MatchedShotID, &record.AssetID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveUploadSession(ctx context.Context, record asset.UploadSession) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO upload_sessions (
			id, organization_id, project_id, import_batch_id, status, storage_provider,
			object_key_prefix, expires_at, created_at, updated_at, completed_at,
			file_name, checksum_sha256, size_bytes, retry_count, resume_hint, last_retry_at
		) VALUES ($1, $2, $3, $4, $5, 'dev-local', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    import_batch_id = EXCLUDED.import_batch_id,
		    status = EXCLUDED.status,
		    expires_at = EXCLUDED.expires_at,
		    updated_at = EXCLUDED.updated_at,
		    completed_at = EXCLUDED.completed_at,
		    file_name = EXCLUDED.file_name,
		    checksum_sha256 = EXCLUDED.checksum_sha256,
		    size_bytes = EXCLUDED.size_bytes,
		    retry_count = EXCLUDED.retry_count,
		    resume_hint = EXCLUDED.resume_hint,
		    last_retry_at = EXCLUDED.last_retry_at
	`, record.ID, record.OrgID, nullableUUID(record.ProjectID), nullableUUID(record.ImportBatchID), normalizeUploadSessionStatusForDB(record.Status, record.ExpiresAt), fmt.Sprintf("uploads/%s", record.ID), record.ExpiresAt, record.CreatedAt, record.CreatedAt, nullableTime(ifStatusUploaded(record.Status, record.CreatedAt)), emptyToNil(record.FileName), emptyToNil(record.Checksum), nullableInt64(record.SizeBytes), record.RetryCount, emptyToNil(record.ResumeHint), nullableTime(record.LastRetryAt))
	if err != nil {
		return fmt.Errorf("db: upsert upload session %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetUploadSession(sessionID string) (asset.UploadSession, bool) {
	if s == nil || s.db == nil {
		return asset.UploadSession{}, false
	}
	record := asset.UploadSession{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, COALESCE(project_id::text, ''), COALESCE(import_batch_id::text, ''),
		       COALESCE(file_name, ''), COALESCE(checksum_sha256, ''), COALESCE(size_bytes, 0), COALESCE(retry_count, 0),
		       status, COALESCE(resume_hint, ''), created_at, expires_at, COALESCE(last_retry_at, created_at)
		FROM upload_sessions
		WHERE id = $1
	`, strings.TrimSpace(sessionID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.ProjectID,
		&record.ImportBatchID,
		&record.FileName,
		&record.Checksum,
		&record.SizeBytes,
		&record.RetryCount,
		&record.Status,
		&record.ResumeHint,
		&record.CreatedAt,
		&record.ExpiresAt,
		&record.LastRetryAt,
	)
	if err != nil {
		return asset.UploadSession{}, false
	}
	record.Status = normalizeUploadSessionStatusFromDB(record.Status)
	record.CreatedAt = record.CreatedAt.UTC()
	record.ExpiresAt = record.ExpiresAt.UTC()
	record.LastRetryAt = record.LastRetryAt.UTC()
	return record, true
}

func (s *PostgresStore) ListUploadSessionsByImportBatch(importBatchID string) []asset.UploadSession {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, COALESCE(project_id::text, ''), COALESCE(import_batch_id::text, ''),
		       COALESCE(file_name, ''), COALESCE(checksum_sha256, ''), COALESCE(size_bytes, 0), COALESCE(retry_count, 0),
		       status, COALESCE(resume_hint, ''), created_at, expires_at, COALESCE(last_retry_at, created_at)
		FROM upload_sessions
		WHERE import_batch_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(importBatchID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.UploadSession, 0)
	for rows.Next() {
		var record asset.UploadSession
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ImportBatchID, &record.FileName, &record.Checksum, &record.SizeBytes, &record.RetryCount, &record.Status, &record.ResumeHint, &record.CreatedAt, &record.ExpiresAt, &record.LastRetryAt); err != nil {
			return nil
		}
		record.Status = normalizeUploadSessionStatusFromDB(record.Status)
		record.CreatedAt = record.CreatedAt.UTC()
		record.ExpiresAt = record.ExpiresAt.UTC()
		record.LastRetryAt = record.LastRetryAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveUploadFile(ctx context.Context, record asset.UploadFile) error {
	status := "pending"
	if session, ok := s.GetUploadSession(record.UploadSessionID); ok && strings.TrimSpace(session.Status) == "uploaded" {
		status = "uploaded"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO upload_files (
			id, upload_session_id, original_file_name, mime_type, file_size_bytes,
			checksum_sha256, storage_key, status, uploaded_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE
		SET upload_session_id = EXCLUDED.upload_session_id,
		    original_file_name = EXCLUDED.original_file_name,
		    mime_type = EXCLUDED.mime_type,
		    file_size_bytes = EXCLUDED.file_size_bytes,
		    checksum_sha256 = EXCLUDED.checksum_sha256,
		    status = EXCLUDED.status,
		    uploaded_at = EXCLUDED.uploaded_at,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.UploadSessionID, record.FileName, emptyToNil(record.MimeType), nullableInt64(record.SizeBytes), emptyToNil(record.Checksum), fmt.Sprintf("upload-files/%s", record.ID), status, nullableTime(record.CreatedAt), record.CreatedAt, record.CreatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert upload file %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListUploadFilesBySessionIDs(sessionIDs []string) []asset.UploadFile {
	if s == nil || s.db == nil || len(sessionIDs) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, upload_session_id::text, original_file_name, COALESCE(mime_type, ''),
		       COALESCE(checksum_sha256, ''), COALESCE(file_size_bytes, 0), created_at
		FROM upload_files
		WHERE upload_session_id = ANY($1::uuid[])
		ORDER BY id ASC
	`, pqStringUUIDArray(sessionIDs))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.UploadFile, 0)
	for rows.Next() {
		var record asset.UploadFile
		if err := rows.Scan(&record.ID, &record.UploadSessionID, &record.FileName, &record.MimeType, &record.Checksum, &record.SizeBytes, &record.CreatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveMediaAsset(ctx context.Context, record asset.MediaAsset) error {
	aiDisclosureStatus := "unknown"
	if record.AIAnnotated {
		aiDisclosureStatus = "completed"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO media_assets (
			id, organization_id, project_id, import_batch_id, upload_file_id, asset_type,
			source_type, storage_key, ai_disclosure_status, rights_status, consent_status,
			created_at, updated_at, locale, ai_annotated
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unknown', $11, $12, $13, $14)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    import_batch_id = EXCLUDED.import_batch_id,
		    upload_file_id = EXCLUDED.upload_file_id,
		    asset_type = EXCLUDED.asset_type,
		    source_type = EXCLUDED.source_type,
		    ai_disclosure_status = EXCLUDED.ai_disclosure_status,
		    rights_status = EXCLUDED.rights_status,
		    updated_at = EXCLUDED.updated_at,
		    locale = EXCLUDED.locale,
		    ai_annotated = EXCLUDED.ai_annotated
	`, record.ID, record.OrgID, record.ProjectID, nullableUUID(record.ImportBatchID), nullableUUID(s.lookupUploadFileIDByAssetID(ctx, record.ID)), normalizeAssetMediaType(record.MediaType), defaultString(record.SourceType, "upload_session"), fmt.Sprintf("media-assets/%s", record.ID), aiDisclosureStatus, defaultString(record.RightsStatus, "unknown"), record.CreatedAt, record.UpdatedAt, emptyToNil(record.Locale), record.AIAnnotated)
	if err != nil {
		return fmt.Errorf("db: upsert media asset %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetMediaAsset(assetID string) (asset.MediaAsset, bool) {
	if s == nil || s.db == nil {
		return asset.MediaAsset{}, false
	}
	record := asset.MediaAsset{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(import_batch_id::text, ''),
		       asset_type, source_type, COALESCE(locale, ''), rights_status, ai_annotated, created_at, updated_at
		FROM media_assets
		WHERE id = $1
	`, strings.TrimSpace(assetID)).Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ImportBatchID, &record.MediaType, &record.SourceType, &record.Locale, &record.RightsStatus, &record.AIAnnotated, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return asset.MediaAsset{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListMediaAssetsByIDs(assetIDs []string) []asset.MediaAsset {
	if s == nil || s.db == nil || len(assetIDs) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(import_batch_id::text, ''),
		       asset_type, source_type, COALESCE(locale, ''), rights_status, ai_annotated, created_at, updated_at
		FROM media_assets
		WHERE id = ANY($1::uuid[])
		ORDER BY id ASC
	`, pqStringUUIDArray(assetIDs))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.MediaAsset, 0)
	for rows.Next() {
		var record asset.MediaAsset
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ImportBatchID, &record.MediaType, &record.SourceType, &record.Locale, &record.RightsStatus, &record.AIAnnotated, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListMediaAssetsByImportBatch(importBatchID string) []asset.MediaAsset {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(import_batch_id::text, ''),
		       asset_type, source_type, COALESCE(locale, ''), rights_status, ai_annotated, created_at, updated_at
		FROM media_assets
		WHERE import_batch_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(importBatchID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.MediaAsset, 0)
	for rows.Next() {
		var record asset.MediaAsset
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ImportBatchID, &record.MediaType, &record.SourceType, &record.Locale, &record.RightsStatus, &record.AIAnnotated, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveMediaAssetVariant(ctx context.Context, record asset.MediaAssetVariant) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin media asset variant tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO media_asset_variants (
			id, media_asset_id, variant_type, storage_key, mime_type, width, height, duration_ms, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE
		SET media_asset_id = EXCLUDED.media_asset_id,
		    variant_type = EXCLUDED.variant_type,
		    mime_type = EXCLUDED.mime_type,
		    width = EXCLUDED.width,
		    height = EXCLUDED.height,
		    duration_ms = EXCLUDED.duration_ms,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.AssetID, defaultString(record.VariantType, "original"), fmt.Sprintf("media-asset-variants/%s", record.ID), emptyToNil(record.MimeType), nullableInt(record.Width), nullableInt(record.Height), nullableInt(record.DurationMS), record.CreatedAt, record.CreatedAt); err != nil {
		return fmt.Errorf("db: upsert media asset variant %s: %w", record.ID, err)
	}
	if strings.TrimSpace(record.UploadFileID) != "" {
		if _, err := tx.ExecContext(ctx, `
			UPDATE media_assets
			SET upload_file_id = $2, updated_at = NOW()
			WHERE id = $1
		`, record.AssetID, nullableUUID(record.UploadFileID)); err != nil {
			return fmt.Errorf("db: bind upload file %s to media asset %s: %w", record.UploadFileID, record.AssetID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit media asset variant tx: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListMediaAssetVariantsByUploadFileIDs(uploadFileIDs []string) []asset.MediaAssetVariant {
	return s.listMediaAssetVariants(`
		SELECT media_asset_variants.id::text, media_asset_variants.media_asset_id::text, COALESCE(media_assets.upload_file_id::text, ''), media_asset_variants.variant_type,
		       COALESCE(media_asset_variants.mime_type, ''), COALESCE(media_asset_variants.width, 0), COALESCE(media_asset_variants.height, 0),
		       COALESCE(media_asset_variants.duration_ms, 0), media_asset_variants.created_at
		FROM media_asset_variants
		JOIN media_assets ON media_assets.id = media_asset_variants.media_asset_id
		WHERE media_assets.upload_file_id = ANY($1::uuid[])
		ORDER BY media_asset_variants.id ASC
	`, pqStringUUIDArray(uploadFileIDs))
}

func (s *PostgresStore) ListMediaAssetVariantsByAssetIDs(assetIDs []string) []asset.MediaAssetVariant {
	return s.listMediaAssetVariants(`
		SELECT media_asset_variants.id::text, media_asset_variants.media_asset_id::text, COALESCE(media_assets.upload_file_id::text, ''), media_asset_variants.variant_type,
		       COALESCE(media_asset_variants.mime_type, ''), COALESCE(media_asset_variants.width, 0), COALESCE(media_asset_variants.height, 0),
		       COALESCE(media_asset_variants.duration_ms, 0), media_asset_variants.created_at
		FROM media_asset_variants
		JOIN media_assets ON media_assets.id = media_asset_variants.media_asset_id
		WHERE media_asset_id = ANY($1::uuid[])
		ORDER BY media_asset_variants.id ASC
	`, pqStringUUIDArray(assetIDs))
}

func (s *PostgresStore) listMediaAssetVariants(query string, ids any) []asset.MediaAssetVariant {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), query, ids)
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.MediaAssetVariant, 0)
	for rows.Next() {
		var record asset.MediaAssetVariant
		if err := rows.Scan(&record.ID, &record.AssetID, &record.UploadFileID, &record.VariantType, &record.MimeType, &record.Width, &record.Height, &record.DurationMS, &record.CreatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveCandidateAsset(ctx context.Context, record asset.CandidateAsset) error {
	selectionStatus := "candidate"
	if shotExecution, ok := s.GetShotExecution(record.ShotExecutionID); ok && shotExecution.PrimaryAssetID == record.AssetID {
		selectionStatus = "selected_primary"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shot_candidate_assets (
			id, shot_execution_id, media_asset_id, source_run_id, source_import_batch_item_id,
			selection_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET shot_execution_id = EXCLUDED.shot_execution_id,
		    media_asset_id = EXCLUDED.media_asset_id,
		    source_run_id = EXCLUDED.source_run_id,
		    source_import_batch_item_id = EXCLUDED.source_import_batch_item_id,
		    selection_status = EXCLUDED.selection_status,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ShotExecutionID, record.AssetID, nullableUUID(record.SourceRunID), nullableUUID(s.lookupImportBatchItemIDByAssetID(ctx, record.AssetID)), selectionStatus, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert candidate asset %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListCandidateAssetsByExecution(shotExecutionID string) []asset.CandidateAsset {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, media_asset_id::text, COALESCE(source_run_id::text, ''), created_at, updated_at
		FROM shot_candidate_assets
		WHERE shot_execution_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(shotExecutionID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.CandidateAsset, 0)
	for rows.Next() {
		var record asset.CandidateAsset
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.AssetID, &record.SourceRunID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListCandidateAssetsByAssetIDs(assetIDs []string) []asset.CandidateAsset {
	if s == nil || s.db == nil || len(assetIDs) == 0 {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, media_asset_id::text, COALESCE(source_run_id::text, ''), created_at, updated_at
		FROM shot_candidate_assets
		WHERE media_asset_id = ANY($1::uuid[])
		ORDER BY id ASC
	`, pqStringUUIDArray(assetIDs))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]asset.CandidateAsset, 0)
	for rows.Next() {
		var record asset.CandidateAsset
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.AssetID, &record.SourceRunID, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func pqStringUUIDArray(ids []string) any {
	values := make([]string, 0, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return pq.Array(values)
}

func (s *PostgresStore) lookupUploadFileIDByAssetID(ctx context.Context, assetID string) string {
	if strings.TrimSpace(assetID) == "" {
		return ""
	}
	var uploadFileID sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT upload_file_id::text
		FROM media_assets
		WHERE id = $1 AND upload_file_id IS NOT NULL
		LIMIT 1
	`, strings.TrimSpace(assetID)).Scan(&uploadFileID)
	if err != nil {
		return ""
	}
	return nullStringValue(uploadFileID)
}

func (s *PostgresStore) lookupImportBatchItemIDByAssetID(ctx context.Context, assetID string) string {
	if strings.TrimSpace(assetID) == "" {
		return ""
	}
	var itemID string
	err := s.db.QueryRowContext(ctx, `
		SELECT id::text
		FROM import_batch_items
		WHERE media_asset_id = $1
		ORDER BY created_at ASC, id ASC
		LIMIT 1
	`, strings.TrimSpace(assetID)).Scan(&itemID)
	if err != nil {
		return ""
	}
	return itemID
}
