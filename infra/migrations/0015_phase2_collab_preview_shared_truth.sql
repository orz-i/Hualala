BEGIN;

CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id text PRIMARY KEY,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  draft_version integer NOT NULL DEFAULT 0,
  lock_holder_user_id text,
  lease_expires_at timestamptz,
  conflict_summary text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS collaboration_sessions_owner_idx
  ON collaboration_sessions (owner_type, owner_id);

CREATE INDEX IF NOT EXISTS collaboration_sessions_lock_idx
  ON collaboration_sessions (lock_holder_user_id, lease_expires_at);

CREATE TABLE IF NOT EXISTS collaboration_presences (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  user_id text NOT NULL,
  status text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS collaboration_presences_session_user_idx
  ON collaboration_presences (session_id, user_id);

CREATE INDEX IF NOT EXISTS collaboration_presences_session_idx
  ON collaboration_presences (session_id, updated_at);

CREATE TABLE IF NOT EXISTS preview_assemblies (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  episode_id text,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS preview_assemblies_scope_idx
  ON preview_assemblies (project_id, COALESCE(episode_id, ''));

CREATE INDEX IF NOT EXISTS preview_assemblies_status_idx
  ON preview_assemblies (project_id, status, updated_at);

CREATE TABLE IF NOT EXISTS preview_assembly_items (
  id text PRIMARY KEY,
  assembly_id text NOT NULL,
  shot_id text NOT NULL,
  primary_asset_id text,
  source_run_id text,
  sequence integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS preview_assembly_items_sequence_idx
  ON preview_assembly_items (assembly_id, sequence);

CREATE INDEX IF NOT EXISTS preview_assembly_items_shot_idx
  ON preview_assembly_items (assembly_id, shot_id);

COMMIT;
