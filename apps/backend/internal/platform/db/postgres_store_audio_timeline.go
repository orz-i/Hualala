package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (s *PostgresStore) SaveAudioTimeline(ctx context.Context, record project.AudioTimeline) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audio_timelines (
			id, project_id, episode_id, status, render_workflow_run_id, render_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_id = EXCLUDED.episode_id,
		    status = EXCLUDED.status,
		    render_workflow_run_id = EXCLUDED.render_workflow_run_id,
		    render_status = EXCLUDED.render_status,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert audio timeline %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetAudioTimeline(projectID string, episodeID string) (project.AudioTimeline, bool) {
	if s == nil || s.db == nil {
		return project.AudioTimeline{}, false
	}
	record := project.AudioTimeline{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, project_id, COALESCE(episode_id::text, ''), status, COALESCE(render_workflow_run_id::text, ''),
		       render_status, created_at, updated_at
		FROM audio_timelines
		WHERE project_id = $1 AND COALESCE(episode_id::text, '') = $2
		LIMIT 1
	`, strings.TrimSpace(projectID), strings.TrimSpace(episodeID)).Scan(
		&record.ID,
		&record.ProjectID,
		&record.EpisodeID,
		&record.Status,
		&record.RenderWorkflowRunID,
		&record.RenderStatus,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.AudioTimeline{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ReplaceAudioTracks(ctx context.Context, timelineID string, tracks []project.AudioTrack) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin replace audio tracks: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM audio_clips
		WHERE track_id IN (SELECT id FROM audio_tracks WHERE timeline_id = $1)
	`, strings.TrimSpace(timelineID)); err != nil {
		return fmt.Errorf("db: clear audio clips for timeline %s: %w", timelineID, err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM audio_tracks WHERE timeline_id = $1`, strings.TrimSpace(timelineID)); err != nil {
		return fmt.Errorf("db: clear audio tracks for timeline %s: %w", timelineID, err)
	}
	for _, track := range tracks {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_tracks (
				id, timeline_id, track_type, display_name, sequence, muted, solo, volume_percent, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, track.ID, track.TimelineID, track.TrackType, track.DisplayName, track.Sequence, track.Muted, track.Solo, track.VolumePercent, track.CreatedAt, track.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio track %s: %w", track.ID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit replace audio tracks: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListAudioTracks(timelineID string) []project.AudioTrack {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id, timeline_id, track_type, display_name, sequence, muted, solo, volume_percent, created_at, updated_at
		FROM audio_tracks
		WHERE timeline_id = $1
		ORDER BY sequence ASC, id ASC
	`, strings.TrimSpace(timelineID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]project.AudioTrack, 0)
	for rows.Next() {
		var record project.AudioTrack
		if err := rows.Scan(&record.ID, &record.TimelineID, &record.TrackType, &record.DisplayName, &record.Sequence, &record.Muted, &record.Solo, &record.VolumePercent, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		record.Clips = nil
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ReplaceAudioClips(ctx context.Context, trackID string, clips []project.AudioClip) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin replace audio clips: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM audio_clips WHERE track_id = $1`, strings.TrimSpace(trackID)); err != nil {
		return fmt.Errorf("db: clear audio clips for track %s: %w", trackID, err)
	}
	for _, clip := range clips {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_clips (
				id, track_id, asset_id, source_run_id, sequence, start_ms, duration_ms, trim_in_ms, trim_out_ms, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, clip.ID, clip.TrackID, clip.AssetID, emptyToNil(clip.SourceRunID), clip.Sequence, clip.StartMs, clip.DurationMs, clip.TrimInMs, clip.TrimOutMs, clip.CreatedAt, clip.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio clip %s: %w", clip.ID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit replace audio clips: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListAudioClips(trackID string) []project.AudioClip {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id, track_id, asset_id, COALESCE(source_run_id::text, ''), sequence, start_ms, duration_ms, trim_in_ms, trim_out_ms, created_at, updated_at
		FROM audio_clips
		WHERE track_id = $1
		ORDER BY sequence ASC, id ASC
	`, strings.TrimSpace(trackID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]project.AudioClip, 0)
	for rows.Next() {
		var record project.AudioClip
		if err := rows.Scan(&record.ID, &record.TrackID, &record.AssetID, &record.SourceRunID, &record.Sequence, &record.StartMs, &record.DurationMs, &record.TrimInMs, &record.TrimOutMs, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}
