BEGIN;

CREATE TABLE story_bibles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT story_bibles_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT story_bibles_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived'))
);

CREATE TABLE characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    story_bible_id uuid REFERENCES story_bibles(id) ON DELETE SET NULL,
    name text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT characters_project_name_unique UNIQUE (project_id, name),
    CONSTRAINT characters_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT characters_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived'))
);

CREATE TABLE scripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
    title text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT scripts_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT scripts_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived'))
);

CREATE TABLE storyboards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
    scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
    title text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT storyboards_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT storyboards_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived'))
);

CREATE TABLE shots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    shot_no integer NOT NULL,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    shot_size text,
    camera_move text,
    subject_action text,
    composition_notes text,
    continuity_notes text,
    source_locale text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT shots_scene_shot_no_unique UNIQUE (scene_id, shot_no),
    CONSTRAINT shots_shot_no_positive CHECK (shot_no > 0),
    CONSTRAINT shots_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived'))
);

CREATE TABLE content_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    snapshot_kind text NOT NULL,
    locale text NOT NULL,
    translation_group_id uuid NOT NULL,
    source_snapshot_id uuid REFERENCES content_snapshots(id) ON DELETE SET NULL,
    translation_status text NOT NULL DEFAULT 'source',
    body text NOT NULL,
    summary text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_snapshots_resource_type_not_blank CHECK (btrim(resource_type) <> ''),
    CONSTRAINT content_snapshots_snapshot_kind_not_blank CHECK (btrim(snapshot_kind) <> ''),
    CONSTRAINT content_snapshots_locale_not_blank CHECK (btrim(locale) <> ''),
    CONSTRAINT content_snapshots_translation_status_valid CHECK (translation_status IN ('source', 'draft_translation', 'reviewed_translation'))
);

CREATE INDEX idx_story_bibles_project_id ON story_bibles (project_id);
CREATE INDEX idx_characters_project_id ON characters (project_id);
CREATE INDEX idx_characters_story_bible_id ON characters (story_bible_id) WHERE story_bible_id IS NOT NULL;
CREATE INDEX idx_scripts_project_id ON scripts (project_id);
CREATE INDEX idx_scripts_episode_id ON scripts (episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX idx_storyboards_project_id ON storyboards (project_id);
CREATE INDEX idx_storyboards_episode_id ON storyboards (episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX idx_storyboards_scene_id ON storyboards (scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX idx_shots_scene_id ON shots (scene_id);
CREATE INDEX idx_shots_lifecycle_status ON shots (lifecycle_status);
CREATE INDEX idx_content_snapshots_resource ON content_snapshots (resource_type, resource_id);
CREATE INDEX idx_content_snapshots_kind ON content_snapshots (snapshot_kind);
CREATE INDEX idx_content_snapshots_locale_group ON content_snapshots (locale, translation_group_id);
CREATE INDEX idx_content_snapshots_source_snapshot_id ON content_snapshots (source_snapshot_id) WHERE source_snapshot_id IS NOT NULL;

COMMIT;
