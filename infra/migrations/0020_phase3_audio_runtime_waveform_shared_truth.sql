CREATE TABLE IF NOT EXISTS audio_runtimes (
    id text PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
    audio_timeline_id uuid NOT NULL REFERENCES audio_timelines(id) ON DELETE CASCADE,
    status text NOT NULL,
    render_workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
    render_status text NOT NULL,
    mix_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    mix_delivery_mode text,
    mix_playback_url text,
    mix_download_url text,
    mix_mime_type text,
    mix_file_name text,
    mix_size_bytes bigint,
    mix_duration_ms integer,
    waveforms jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_error_code text,
    last_error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audio_runtimes_status_non_empty CHECK (length(trim(status)) > 0),
    CONSTRAINT audio_runtimes_render_status_non_empty CHECK (length(trim(render_status)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS audio_runtimes_scope_idx
  ON audio_runtimes (project_id, COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS audio_runtimes_render_idx
  ON audio_runtimes (project_id, render_status, updated_at);
