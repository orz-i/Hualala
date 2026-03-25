package db

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (s *PostgresStore) SavePreviewRuntime(ctx context.Context, record project.PreviewRuntime) error {
	playbackTimeline, err := encodePreviewTimelineSpine(record.Playback.Timeline)
	if err != nil {
		return fmt.Errorf("db: encode preview timeline spine: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO preview_runtimes (
			id, project_id, episode_id, assembly_id, status, render_workflow_run_id, render_status,
			playback_asset_id, export_asset_id, resolved_locale,
			playback_delivery_mode, playback_url, playback_poster_url, playback_duration_ms, playback_timeline,
			export_download_url, export_mime_type, export_file_name, export_size_bytes,
			last_error_code, last_error_message, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_id = EXCLUDED.episode_id,
		    assembly_id = EXCLUDED.assembly_id,
		    status = EXCLUDED.status,
		    render_workflow_run_id = EXCLUDED.render_workflow_run_id,
		    render_status = EXCLUDED.render_status,
		    playback_asset_id = EXCLUDED.playback_asset_id,
		    export_asset_id = EXCLUDED.export_asset_id,
		    resolved_locale = EXCLUDED.resolved_locale,
		    playback_delivery_mode = EXCLUDED.playback_delivery_mode,
		    playback_url = EXCLUDED.playback_url,
		    playback_poster_url = EXCLUDED.playback_poster_url,
		    playback_duration_ms = EXCLUDED.playback_duration_ms,
		    playback_timeline = EXCLUDED.playback_timeline,
		    export_download_url = EXCLUDED.export_download_url,
		    export_mime_type = EXCLUDED.export_mime_type,
		    export_file_name = EXCLUDED.export_file_name,
		    export_size_bytes = EXCLUDED.export_size_bytes,
		    last_error_code = EXCLUDED.last_error_code,
		    last_error_message = EXCLUDED.last_error_message,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), record.AssemblyID, defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), emptyToNil(record.PlaybackAssetID), emptyToNil(record.ExportAssetID), strings.TrimSpace(record.ResolvedLocale), emptyToNil(record.Playback.DeliveryMode), emptyToNil(record.Playback.PlaybackURL), emptyToNil(record.Playback.PosterURL), nullableInt(record.Playback.DurationMs), playbackTimeline, emptyToNil(record.ExportOutput.DownloadURL), emptyToNil(record.ExportOutput.MimeType), emptyToNil(record.ExportOutput.FileName), nullableInt64(record.ExportOutput.SizeBytes), emptyToNil(record.LastErrorCode), emptyToNil(record.LastErrorMessage), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert preview runtime %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetPreviewRuntime(projectID string, episodeID string) (project.PreviewRuntime, bool) {
	if s == nil || s.db == nil {
		return project.PreviewRuntime{}, false
	}
	record := project.PreviewRuntime{}
	var playbackTimelineText string
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, project_id, COALESCE(episode_id, ''), assembly_id, status,
		       COALESCE(render_workflow_run_id, ''), render_status,
		       COALESCE(playback_asset_id, ''), COALESCE(export_asset_id, ''),
		       COALESCE(resolved_locale, ''),
		       COALESCE(playback_delivery_mode, ''), COALESCE(playback_url, ''), COALESCE(playback_poster_url, ''), COALESCE(playback_duration_ms, 0), COALESCE(playback_timeline, '{}'::jsonb)::text,
		       COALESCE(export_download_url, ''), COALESCE(export_mime_type, ''), COALESCE(export_file_name, ''), COALESCE(export_size_bytes, 0),
		       COALESCE(last_error_code, ''), COALESCE(last_error_message, ''), created_at, updated_at
		FROM preview_runtimes
		WHERE project_id = $1 AND COALESCE(episode_id, '') = $2
		LIMIT 1
	`, strings.TrimSpace(projectID), strings.TrimSpace(episodeID)).Scan(
		&record.ID,
		&record.ProjectID,
		&record.EpisodeID,
		&record.AssemblyID,
		&record.Status,
		&record.RenderWorkflowRunID,
		&record.RenderStatus,
		&record.PlaybackAssetID,
		&record.ExportAssetID,
		&record.ResolvedLocale,
		&record.Playback.DeliveryMode,
		&record.Playback.PlaybackURL,
		&record.Playback.PosterURL,
		&record.Playback.DurationMs,
		&playbackTimelineText,
		&record.ExportOutput.DownloadURL,
		&record.ExportOutput.MimeType,
		&record.ExportOutput.FileName,
		&record.ExportOutput.SizeBytes,
		&record.LastErrorCode,
		&record.LastErrorMessage,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.PreviewRuntime{}, false
	}
	record.Playback.Timeline, err = decodePreviewTimelineSpine(playbackTimelineText)
	if err != nil {
		log.Printf("db: failed to decode preview runtime timeline for project=%s episode=%s runtime=%s: %v", record.ProjectID, record.EpisodeID, record.ID, err)
		return project.PreviewRuntime{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) GetPreviewRuntimeByID(previewRuntimeID string) (project.PreviewRuntime, bool) {
	if s == nil || s.db == nil {
		return project.PreviewRuntime{}, false
	}
	record := project.PreviewRuntime{}
	var playbackTimelineText string
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, project_id, COALESCE(episode_id, ''), assembly_id, status,
		       COALESCE(render_workflow_run_id, ''), render_status,
		       COALESCE(playback_asset_id, ''), COALESCE(export_asset_id, ''),
		       COALESCE(resolved_locale, ''),
		       COALESCE(playback_delivery_mode, ''), COALESCE(playback_url, ''), COALESCE(playback_poster_url, ''), COALESCE(playback_duration_ms, 0), COALESCE(playback_timeline, '{}'::jsonb)::text,
		       COALESCE(export_download_url, ''), COALESCE(export_mime_type, ''), COALESCE(export_file_name, ''), COALESCE(export_size_bytes, 0),
		       COALESCE(last_error_code, ''), COALESCE(last_error_message, ''), created_at, updated_at
		FROM preview_runtimes
		WHERE id = $1
		LIMIT 1
	`, strings.TrimSpace(previewRuntimeID)).Scan(
		&record.ID,
		&record.ProjectID,
		&record.EpisodeID,
		&record.AssemblyID,
		&record.Status,
		&record.RenderWorkflowRunID,
		&record.RenderStatus,
		&record.PlaybackAssetID,
		&record.ExportAssetID,
		&record.ResolvedLocale,
		&record.Playback.DeliveryMode,
		&record.Playback.PlaybackURL,
		&record.Playback.PosterURL,
		&record.Playback.DurationMs,
		&playbackTimelineText,
		&record.ExportOutput.DownloadURL,
		&record.ExportOutput.MimeType,
		&record.ExportOutput.FileName,
		&record.ExportOutput.SizeBytes,
		&record.LastErrorCode,
		&record.LastErrorMessage,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.PreviewRuntime{}, false
	}
	record.Playback.Timeline, err = decodePreviewTimelineSpine(playbackTimelineText)
	if err != nil {
		log.Printf("db: failed to decode preview runtime timeline by id for runtime=%s: %v", record.ID, err)
		return project.PreviewRuntime{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}
