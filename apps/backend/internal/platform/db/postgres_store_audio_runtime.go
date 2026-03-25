package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/workflow"
)

func (s *PostgresStore) SaveAudioRuntime(ctx context.Context, record project.AudioRuntime) error {
	return saveAudioRuntimeExec(ctx, s.db, record)
}

func (s *PostgresStore) SaveAudioRuntimeAndWorkflowRun(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun) error {
	if s == nil || s.db == nil {
		return errors.New("db: postgres store requires database handle")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin audio runtime/workflow tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()
	if err := saveAudioRuntimeExec(ctx, tx, runtimeRecord); err != nil {
		return err
	}
	if err := saveWorkflowRunExec(ctx, tx, workflowRun); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit audio runtime/workflow tx: %w", err)
	}
	return nil
}

func (s *PostgresStore) SaveAudioRuntimeAndWorkflowDispatch(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun, workflowStep workflow.WorkflowStep, job workflow.Job, transition workflow.StateTransition) error {
	if s == nil || s.db == nil {
		return errors.New("db: postgres store requires database handle")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin audio runtime/workflow dispatch tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()
	if err := saveAudioRuntimeExec(ctx, tx, runtimeRecord); err != nil {
		return err
	}
	if err := saveWorkflowRunExec(ctx, tx, workflowRun); err != nil {
		return err
	}
	if err := saveStateTransitionExec(ctx, tx, transition); err != nil {
		return err
	}
	if err := saveWorkflowStepExec(ctx, tx, workflowStep); err != nil {
		return err
	}
	if err := saveJobExec(ctx, tx, job); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit audio runtime/workflow dispatch tx: %w", err)
	}
	return nil
}

func saveAudioRuntimeExec(ctx context.Context, execer sqlContextExecutor, record project.AudioRuntime) error {
	waveforms, err := encodeAudioWaveformReferences(record.Waveforms)
	if err != nil {
		return fmt.Errorf("db: encode audio waveform references: %w", err)
	}
	_, err = execer.ExecContext(ctx, `
		INSERT INTO audio_runtimes (
			id, project_id, episode_id, audio_timeline_id, status, render_workflow_run_id, render_status,
			mix_asset_id, mix_delivery_mode, mix_playback_url, mix_download_url, mix_mime_type,
			mix_file_name, mix_size_bytes, mix_duration_ms, waveforms,
			last_error_code, last_error_message, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_id = EXCLUDED.episode_id,
		    audio_timeline_id = EXCLUDED.audio_timeline_id,
		    status = EXCLUDED.status,
		    render_workflow_run_id = EXCLUDED.render_workflow_run_id,
		    render_status = EXCLUDED.render_status,
		    mix_asset_id = EXCLUDED.mix_asset_id,
		    mix_delivery_mode = EXCLUDED.mix_delivery_mode,
		    mix_playback_url = EXCLUDED.mix_playback_url,
		    mix_download_url = EXCLUDED.mix_download_url,
		    mix_mime_type = EXCLUDED.mix_mime_type,
		    mix_file_name = EXCLUDED.mix_file_name,
		    mix_size_bytes = EXCLUDED.mix_size_bytes,
		    mix_duration_ms = EXCLUDED.mix_duration_ms,
		    waveforms = EXCLUDED.waveforms,
		    last_error_code = EXCLUDED.last_error_code,
		    last_error_message = EXCLUDED.last_error_message,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), record.AudioTimelineID, defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), emptyToNil(record.MixAssetID), emptyToNil(record.MixOutput.DeliveryMode), emptyToNil(record.MixOutput.PlaybackURL), emptyToNil(record.MixOutput.DownloadURL), emptyToNil(record.MixOutput.MimeType), emptyToNil(record.MixOutput.FileName), nullableInt64(record.MixOutput.SizeBytes), nullableInt(record.MixOutput.DurationMs), waveforms, emptyToNil(record.LastErrorCode), emptyToNil(record.LastErrorMessage), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert audio runtime %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetAudioRuntime(projectID string, episodeID string) (project.AudioRuntime, bool, error) {
	if s == nil || s.db == nil {
		return project.AudioRuntime{}, false, nil
	}
	return s.queryAudioRuntime("project/episode scope", `
		SELECT id, project_id::text, COALESCE(episode_id::text, ''), audio_timeline_id::text, status,
		       COALESCE(render_workflow_run_id::text, ''), render_status,
		       COALESCE(mix_asset_id::text, ''), COALESCE(mix_delivery_mode, ''), COALESCE(mix_playback_url, ''),
		       COALESCE(mix_download_url, ''), COALESCE(mix_mime_type, ''), COALESCE(mix_file_name, ''),
		       COALESCE(mix_size_bytes, 0), COALESCE(mix_duration_ms, 0), COALESCE(waveforms, '[]'::jsonb)::text,
		       COALESCE(last_error_code, ''), COALESCE(last_error_message, ''), created_at, updated_at
		FROM audio_runtimes
		WHERE project_id = $1 AND COALESCE(episode_id::text, '') = $2
		LIMIT 1
	`, strings.TrimSpace(projectID), strings.TrimSpace(episodeID))
}

func (s *PostgresStore) GetAudioRuntimeByID(audioRuntimeID string) (project.AudioRuntime, bool, error) {
	if s == nil || s.db == nil {
		return project.AudioRuntime{}, false, nil
	}
	return s.queryAudioRuntime("runtime id", `
		SELECT id, project_id::text, COALESCE(episode_id::text, ''), audio_timeline_id::text, status,
		       COALESCE(render_workflow_run_id::text, ''), render_status,
		       COALESCE(mix_asset_id::text, ''), COALESCE(mix_delivery_mode, ''), COALESCE(mix_playback_url, ''),
		       COALESCE(mix_download_url, ''), COALESCE(mix_mime_type, ''), COALESCE(mix_file_name, ''),
		       COALESCE(mix_size_bytes, 0), COALESCE(mix_duration_ms, 0), COALESCE(waveforms, '[]'::jsonb)::text,
		       COALESCE(last_error_code, ''), COALESCE(last_error_message, ''), created_at, updated_at
		FROM audio_runtimes
		WHERE id = $1
		LIMIT 1
	`, strings.TrimSpace(audioRuntimeID))
}

func (s *PostgresStore) queryAudioRuntime(scope string, query string, args ...any) (project.AudioRuntime, bool, error) {
	record := project.AudioRuntime{}
	var waveformsText string
	err := s.db.QueryRowContext(context.Background(), query, args...).Scan(
		&record.ID,
		&record.ProjectID,
		&record.EpisodeID,
		&record.AudioTimelineID,
		&record.Status,
		&record.RenderWorkflowRunID,
		&record.RenderStatus,
		&record.MixAssetID,
		&record.MixOutput.DeliveryMode,
		&record.MixOutput.PlaybackURL,
		&record.MixOutput.DownloadURL,
		&record.MixOutput.MimeType,
		&record.MixOutput.FileName,
		&record.MixOutput.SizeBytes,
		&record.MixOutput.DurationMs,
		&waveformsText,
		&record.LastErrorCode,
		&record.LastErrorMessage,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return project.AudioRuntime{}, false, nil
	}
	if err != nil {
		return project.AudioRuntime{}, false, fmt.Errorf("db: query audio runtime by %s: %w", scope, err)
	}
	record.Waveforms, err = decodeAudioWaveformReferences(waveformsText)
	if err != nil {
		return project.AudioRuntime{}, false, fmt.Errorf("db: decode audio runtime waveforms by %s for runtime %s: %w", scope, record.ID, err)
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true, nil
}

type sqlContextExecutor interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}
