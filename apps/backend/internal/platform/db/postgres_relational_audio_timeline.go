package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hualala/apps/backend/internal/domain/project"
)

func (p *PostgresPersister) loadAudioTimelines(ctx context.Context, snapshot *Snapshot) error {
	timelineRows, err := p.db.QueryContext(ctx, `
		SELECT id, project_id, COALESCE(episode_id::text, ''), status, COALESCE(render_workflow_run_id::text, ''),
		       render_status, created_at, updated_at
		FROM audio_timelines
	`)
	if err != nil {
		return fmt.Errorf("db: load audio timelines: %w", err)
	}
	defer timelineRows.Close()
	for timelineRows.Next() {
		var record project.AudioTimeline
		if err := timelineRows.Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.Status, &record.RenderWorkflowRunID, &record.RenderStatus, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan audio timeline: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.AudioTimelines[record.ID] = record
	}
	if err := timelineRows.Err(); err != nil {
		return fmt.Errorf("db: iterate audio timelines: %w", err)
	}

	trackRows, err := p.db.QueryContext(ctx, `
		SELECT id, timeline_id, track_type, display_name, sequence, muted, solo, volume_percent, created_at, updated_at
		FROM audio_tracks
	`)
	if err != nil {
		return fmt.Errorf("db: load audio tracks: %w", err)
	}
	defer trackRows.Close()
	for trackRows.Next() {
		var record project.AudioTrack
		if err := trackRows.Scan(&record.ID, &record.TimelineID, &record.TrackType, &record.DisplayName, &record.Sequence, &record.Muted, &record.Solo, &record.VolumePercent, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan audio track: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		record.Clips = nil
		snapshot.AudioTracks[record.ID] = record
	}
	if err := trackRows.Err(); err != nil {
		return fmt.Errorf("db: iterate audio tracks: %w", err)
	}

	clipRows, err := p.db.QueryContext(ctx, `
		SELECT id, track_id, asset_id, COALESCE(source_run_id::text, ''), sequence, start_ms, duration_ms, trim_in_ms, trim_out_ms, created_at, updated_at
		FROM audio_clips
	`)
	if err != nil {
		return fmt.Errorf("db: load audio clips: %w", err)
	}
	defer clipRows.Close()
	for clipRows.Next() {
		var record project.AudioClip
		if err := clipRows.Scan(&record.ID, &record.TrackID, &record.AssetID, &record.SourceRunID, &record.Sequence, &record.StartMs, &record.DurationMs, &record.TrimInMs, &record.TrimOutMs, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan audio clip: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.AudioClips[record.ID] = record
	}
	if err := clipRows.Err(); err != nil {
		return fmt.Errorf("db: iterate audio clips: %w", err)
	}

	updateCounter(&snapshot.NextAudioTimelineID, "audio-timeline-", snapshot.AudioTimelines)
	updateCounter(&snapshot.NextAudioTrackID, "audio-track-", snapshot.AudioTracks)
	updateCounter(&snapshot.NextAudioClipID, "audio-clip-", snapshot.AudioClips)
	return nil
}

func (p *PostgresPersister) saveAudioTimelines(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.AudioTimelines {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_timelines (
				id, project_id, episode_id, status, render_workflow_run_id, render_status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), defaultString(record.Status, "draft"), emptyToNil(record.RenderWorkflowRunID), defaultString(record.RenderStatus, "idle"), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio timeline %s: %w", record.ID, err)
		}
	}
	for _, record := range snapshot.AudioTracks {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_tracks (
				id, timeline_id, track_type, display_name, sequence, muted, solo, volume_percent, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, record.ID, record.TimelineID, record.TrackType, record.DisplayName, record.Sequence, record.Muted, record.Solo, record.VolumePercent, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio track %s: %w", record.ID, err)
		}
	}
	for _, record := range snapshot.AudioClips {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audio_clips (
				id, track_id, asset_id, source_run_id, sequence, start_ms, duration_ms, trim_in_ms, trim_out_ms, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, record.ID, record.TrackID, record.AssetID, emptyToNil(record.SourceRunID), record.Sequence, record.StartMs, record.DurationMs, record.TrimInMs, record.TrimOutMs, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert audio clip %s: %w", record.ID, err)
		}
	}
	return nil
}
