package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (p *PostgresPersister) loadAudioRuntimes(ctx context.Context, snapshot *Snapshot) error {
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, project_id::text, COALESCE(episode_id::text, ''), audio_timeline_id::text, status,
		       COALESCE(render_workflow_run_id::text, ''), render_status,
		       COALESCE(mix_asset_id::text, ''), COALESCE(mix_delivery_mode, ''), COALESCE(mix_playback_url, ''),
		       COALESCE(mix_download_url, ''), COALESCE(mix_mime_type, ''), COALESCE(mix_file_name, ''),
		       COALESCE(mix_size_bytes, 0), COALESCE(mix_duration_ms, 0), COALESCE(waveforms, '[]'::jsonb)::text,
		       COALESCE(last_error_code, ''), COALESCE(last_error_message, ''), created_at, updated_at
		FROM audio_runtimes
	`)
	if err != nil {
		return fmt.Errorf("db: load audio runtimes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var record project.AudioRuntime
		var waveformsText string
		if err := rows.Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.AudioTimelineID, &record.Status, &record.RenderWorkflowRunID, &record.RenderStatus, &record.MixAssetID, &record.MixOutput.DeliveryMode, &record.MixOutput.PlaybackURL, &record.MixOutput.DownloadURL, &record.MixOutput.MimeType, &record.MixOutput.FileName, &record.MixOutput.SizeBytes, &record.MixOutput.DurationMs, &waveformsText, &record.LastErrorCode, &record.LastErrorMessage, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan audio runtime: %w", err)
		}
		record.Waveforms, err = decodeAudioWaveformReferences(waveformsText)
		if err != nil {
			return fmt.Errorf("db: decode audio runtime waveforms: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.AudioRuntimes[record.ID] = record
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("db: iterate audio runtimes: %w", err)
	}
	updateCounter(&snapshot.NextAudioRuntimeID, "audio-runtime-", snapshot.AudioRuntimes)
	return nil
}

func (p *PostgresPersister) saveAudioRuntimes(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.AudioRuntimes {
		waveforms, err := encodeAudioWaveformReferences(record.Waveforms)
		if err != nil {
			return fmt.Errorf("db: encode audio runtime waveforms %s: %w", record.ID, err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_runtimes (
				id, project_id, episode_id, audio_timeline_id, status, render_workflow_run_id, render_status,
				mix_asset_id, mix_delivery_mode, mix_playback_url, mix_download_url, mix_mime_type,
				mix_file_name, mix_size_bytes, mix_duration_ms, waveforms,
				last_error_code, last_error_message, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20)
		`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), record.AudioTimelineID, defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), emptyToNil(record.MixAssetID), emptyToNil(record.MixOutput.DeliveryMode), emptyToNil(record.MixOutput.PlaybackURL), emptyToNil(record.MixOutput.DownloadURL), emptyToNil(record.MixOutput.MimeType), emptyToNil(record.MixOutput.FileName), nullableInt64(record.MixOutput.SizeBytes), nullableInt(record.MixOutput.DurationMs), waveforms, emptyToNil(record.LastErrorCode), emptyToNil(record.LastErrorMessage), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio runtime %s: %w", record.ID, err)
		}
	}
	return nil
}
