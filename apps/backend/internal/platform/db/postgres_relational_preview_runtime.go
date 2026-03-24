package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (p *PostgresPersister) loadPreviewRuntimes(ctx context.Context, snapshot *Snapshot) error {
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, project_id, COALESCE(episode_id, ''), assembly_id, status,
		       COALESCE(render_workflow_run_id, ''), render_status,
		       COALESCE(playback_asset_id, ''), COALESCE(export_asset_id, ''),
		       COALESCE(resolved_locale, ''), created_at, updated_at
		FROM preview_runtimes
	`)
	if err != nil {
		return fmt.Errorf("db: load preview runtimes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var record project.PreviewRuntime
		if err := rows.Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.AssemblyID, &record.Status, &record.RenderWorkflowRunID, &record.RenderStatus, &record.PlaybackAssetID, &record.ExportAssetID, &record.ResolvedLocale, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan preview runtime: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.PreviewRuntimes[record.ID] = record
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("db: iterate preview runtimes: %w", err)
	}
	updateCounter(&snapshot.NextPreviewRuntimeID, "preview-runtime-", snapshot.PreviewRuntimes)
	return nil
}

func (p *PostgresPersister) savePreviewRuntimes(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.PreviewRuntimes {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO preview_runtimes (
				id, project_id, episode_id, assembly_id, status, render_workflow_run_id, render_status,
				playback_asset_id, export_asset_id, resolved_locale, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), record.AssemblyID, defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), emptyToNil(record.PlaybackAssetID), emptyToNil(record.ExportAssetID), record.ResolvedLocale, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert preview runtime %s: %w", record.ID, err)
		}
	}
	return nil
}
