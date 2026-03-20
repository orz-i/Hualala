BEGIN;

CREATE TABLE context_bundles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shot_id uuid REFERENCES shots(id) ON DELETE SET NULL,
    model_profile_id uuid REFERENCES model_profiles(id) ON DELETE SET NULL,
    prompt_template_id uuid REFERENCES prompt_templates(id) ON DELETE SET NULL,
    input_locale text NOT NULL,
    output_locale text NOT NULL,
    resolved_prompt_version integer,
    source_snapshot_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    referenced_asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT context_bundles_input_locale_not_blank CHECK (btrim(input_locale) <> ''),
    CONSTRAINT context_bundles_output_locale_not_blank CHECK (btrim(output_locale) <> '')
);

CREATE TABLE shot_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    current_run_id uuid,
    primary_asset_id uuid,
    latest_submission_gate_status text,
    submitted_for_review_at timestamptz,
    approved_for_use_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shot_executions_shot_id_unique UNIQUE (shot_id),
    CONSTRAINT shot_executions_status_valid CHECK (status IN (
        'pending',
        'in_progress',
        'candidate_ready',
        'primary_selected',
        'submitted_for_review',
        'rework_required',
        'approved_for_use',
        'archived'
    ))
);

CREATE TABLE shot_execution_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shot_execution_id uuid NOT NULL REFERENCES shot_executions(id) ON DELETE CASCADE,
    context_bundle_id uuid REFERENCES context_bundles(id) ON DELETE SET NULL,
    run_number integer NOT NULL,
    run_type text NOT NULL DEFAULT 'generate',
    status text NOT NULL DEFAULT 'pending',
    trigger_source text NOT NULL DEFAULT 'manual',
    idempotency_key text,
    external_request_id text,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    failure_reason text,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shot_execution_runs_execution_run_number_unique UNIQUE (shot_execution_id, run_number),
    CONSTRAINT shot_execution_runs_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT shot_execution_runs_external_request_id_unique UNIQUE (external_request_id),
    CONSTRAINT shot_execution_runs_run_number_positive CHECK (run_number > 0),
    CONSTRAINT shot_execution_runs_status_valid CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT shot_execution_runs_run_type_not_blank CHECK (btrim(run_type) <> ''),
    CONSTRAINT shot_execution_runs_trigger_source_not_blank CHECK (btrim(trigger_source) <> '')
);

ALTER TABLE shot_executions
    ADD CONSTRAINT shot_executions_current_run_fk
    FOREIGN KEY (current_run_id) REFERENCES shot_execution_runs(id) ON DELETE SET NULL;

CREATE INDEX idx_context_bundles_project_id ON context_bundles (project_id);
CREATE INDEX idx_context_bundles_shot_id ON context_bundles (shot_id) WHERE shot_id IS NOT NULL;
CREATE INDEX idx_context_bundles_model_profile_id ON context_bundles (model_profile_id) WHERE model_profile_id IS NOT NULL;
CREATE INDEX idx_shot_executions_project_status ON shot_executions (project_id, status);
CREATE INDEX idx_shot_executions_organization_id ON shot_executions (organization_id);
CREATE INDEX idx_shot_execution_runs_execution_id ON shot_execution_runs (shot_execution_id);
CREATE INDEX idx_shot_execution_runs_status ON shot_execution_runs (status);
CREATE INDEX idx_shot_execution_runs_context_bundle_id ON shot_execution_runs (context_bundle_id) WHERE context_bundle_id IS NOT NULL;

COMMIT;
