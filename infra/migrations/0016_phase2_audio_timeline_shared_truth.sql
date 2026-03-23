CREATE TABLE IF NOT EXISTS audio_timelines (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    episode_id uuid REFERENCES episodes (id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'draft',
    render_workflow_run_id uuid,
    render_status text NOT NULL DEFAULT 'idle',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT audio_timelines_status_non_empty CHECK (length(trim(status)) > 0),
    CONSTRAINT audio_timelines_render_status_non_empty CHECK (length(trim(render_status)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_timelines_scope_idx
  ON audio_timelines (project_id, COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS audio_timelines_render_idx
  ON audio_timelines (project_id, render_status, updated_at);

CREATE TABLE IF NOT EXISTS audio_tracks (
    id uuid PRIMARY KEY,
    timeline_id uuid NOT NULL REFERENCES audio_timelines (id) ON DELETE CASCADE,
    track_type text NOT NULL,
    display_name text NOT NULL,
    sequence integer NOT NULL,
    muted boolean NOT NULL DEFAULT FALSE,
    solo boolean NOT NULL DEFAULT FALSE,
    volume_percent integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT audio_tracks_track_type_valid CHECK (track_type IN ('dialogue', 'voiceover', 'bgm')),
    CONSTRAINT audio_tracks_sequence_positive CHECK (sequence > 0),
    CONSTRAINT audio_tracks_volume_percent_non_negative CHECK (volume_percent >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_tracks_timeline_sequence_idx
  ON audio_tracks (timeline_id, sequence);

CREATE INDEX IF NOT EXISTS audio_tracks_type_idx
  ON audio_tracks (timeline_id, track_type, sequence);

CREATE TABLE IF NOT EXISTS audio_clips (
    id uuid PRIMARY KEY,
    track_id uuid NOT NULL REFERENCES audio_tracks (id) ON DELETE CASCADE,
    asset_id uuid NOT NULL REFERENCES media_assets (id) ON DELETE RESTRICT,
    source_run_id uuid,
    sequence integer NOT NULL,
    start_ms integer NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    trim_in_ms integer NOT NULL DEFAULT 0,
    trim_out_ms integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT audio_clips_sequence_positive CHECK (sequence > 0),
    CONSTRAINT audio_clips_start_ms_non_negative CHECK (start_ms >= 0),
    CONSTRAINT audio_clips_duration_ms_non_negative CHECK (duration_ms >= 0),
    CONSTRAINT audio_clips_trim_in_ms_non_negative CHECK (trim_in_ms >= 0),
    CONSTRAINT audio_clips_trim_out_ms_non_negative CHECK (trim_out_ms >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_clips_track_sequence_idx
  ON audio_clips (track_id, sequence);

CREATE INDEX IF NOT EXISTS audio_clips_asset_idx
  ON audio_clips (asset_id, created_at);
