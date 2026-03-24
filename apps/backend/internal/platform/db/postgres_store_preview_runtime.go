package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (s *PostgresStore) SavePreviewRuntime(ctx context.Context, record project.PreviewRuntime) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO preview_runtimes (
			id, project_id, episode_id, assembly_id, status, render_workflow_run_id, render_status,
			playback_asset_id, export_asset_id, resolved_locale, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), record.AssemblyID, defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), emptyToNil(record.PlaybackAssetID), emptyToNil(record.ExportAssetID), strings.TrimSpace(record.ResolvedLocale), record.CreatedAt, record.UpdatedAt)
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
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, project_id, COALESCE(episode_id, ''), assembly_id, status,
		       COALESCE(render_workflow_run_id, ''), render_status,
		       COALESCE(playback_asset_id, ''), COALESCE(export_asset_id, ''),
		       COALESCE(resolved_locale, ''), created_at, updated_at
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
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.PreviewRuntime{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}
