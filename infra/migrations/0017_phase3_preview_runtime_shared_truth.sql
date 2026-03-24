CREATE TABLE IF NOT EXISTS preview_runtimes (
    id text PRIMARY KEY,
    project_id text NOT NULL,
    episode_id text,
    assembly_id text NOT NULL REFERENCES preview_assemblies (id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'draft',
    render_workflow_run_id text,
    render_status text NOT NULL DEFAULT 'idle',
    playback_asset_id text,
    export_asset_id text,
    resolved_locale text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT preview_runtimes_status_non_empty CHECK (length(trim(status)) > 0),
    CONSTRAINT preview_runtimes_render_status_non_empty CHECK (length(trim(render_status)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS preview_runtimes_scope_idx
  ON preview_runtimes (project_id, COALESCE(episode_id, ''));

CREATE INDEX IF NOT EXISTS preview_runtimes_render_idx
  ON preview_runtimes (project_id, render_status, updated_at);
