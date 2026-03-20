BEGIN;

CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    current_stage text NOT NULL,
    primary_content_locale text NOT NULL,
    supported_content_locales text[] NOT NULL,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT projects_status_valid CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT projects_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT projects_current_stage_not_blank CHECK (btrim(current_stage) <> ''),
    CONSTRAINT projects_primary_content_locale_not_blank CHECK (btrim(primary_content_locale) <> ''),
    CONSTRAINT projects_supported_content_locales_not_empty CHECK (coalesce(array_length(supported_content_locales, 1), 0) > 0)
);

CREATE TABLE episodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_no integer NOT NULL,
    title text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT episodes_project_episode_no_unique UNIQUE (project_id, episode_no),
    CONSTRAINT episodes_episode_no_positive CHECK (episode_no > 0),
    CONSTRAINT episodes_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived')),
    CONSTRAINT episodes_title_not_blank CHECK (btrim(title) <> '')
);

CREATE TABLE scenes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    scene_no integer NOT NULL,
    title text NOT NULL,
    summary text,
    source_locale text,
    lifecycle_status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT scenes_project_scene_no_unique UNIQUE (project_id, scene_no),
    CONSTRAINT scenes_episode_scene_no_unique UNIQUE (episode_id, scene_no),
    CONSTRAINT scenes_scene_no_positive CHECK (scene_no > 0),
    CONSTRAINT scenes_lifecycle_status_valid CHECK (lifecycle_status IN ('draft', 'active', 'archived')),
    CONSTRAINT scenes_title_not_blank CHECK (btrim(title) <> '')
);

CREATE INDEX idx_projects_organization_id ON projects (organization_id);
CREATE INDEX idx_projects_owner_user_id ON projects (owner_user_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_episodes_project_id ON episodes (project_id);
CREATE INDEX idx_episodes_lifecycle_status ON episodes (lifecycle_status);
CREATE INDEX idx_scenes_episode_id ON scenes (episode_id);
CREATE INDEX idx_scenes_project_id ON scenes (project_id);
CREATE INDEX idx_scenes_lifecycle_status ON scenes (lifecycle_status);

COMMIT;
