BEGIN;

CREATE TABLE jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    resource_type text NOT NULL,
    resource_id uuid,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    priority integer NOT NULL DEFAULT 100,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT jobs_status_valid CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT jobs_resource_type_not_blank CHECK (btrim(resource_type) <> ''),
    CONSTRAINT jobs_job_type_not_blank CHECK (btrim(job_type) <> '')
);

CREATE TABLE workflow_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    shot_execution_run_id uuid REFERENCES shot_execution_runs(id) ON DELETE SET NULL,
    workflow_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    trigger_source text NOT NULL DEFAULT 'manual',
    idempotency_key text,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    failure_reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workflow_runs_status_valid CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT workflow_runs_workflow_type_not_blank CHECK (btrim(workflow_type) <> ''),
    CONSTRAINT workflow_runs_trigger_source_not_blank CHECK (btrim(trigger_source) <> ''),
    CONSTRAINT workflow_runs_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE TABLE workflow_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_key text NOT NULL,
    step_order integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    error_code text,
    error_message text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workflow_steps_run_step_key_unique UNIQUE (workflow_run_id, step_key),
    CONSTRAINT workflow_steps_run_step_order_unique UNIQUE (workflow_run_id, step_order),
    CONSTRAINT workflow_steps_step_order_positive CHECK (step_order > 0),
    CONSTRAINT workflow_steps_status_valid CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT workflow_steps_step_key_not_blank CHECK (btrim(step_key) <> '')
);

CREATE TABLE state_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    from_state text,
    to_state text NOT NULL,
    transition_reason text,
    triggered_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT state_transitions_resource_type_not_blank CHECK (btrim(resource_type) <> ''),
    CONSTRAINT state_transitions_to_state_not_blank CHECK (btrim(to_state) <> '')
);

CREATE TABLE event_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    published_at timestamptz,
    failed_at timestamptz,
    retry_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_outbox_aggregate_type_not_blank CHECK (btrim(aggregate_type) <> ''),
    CONSTRAINT event_outbox_event_type_not_blank CHECK (btrim(event_type) <> ''),
    CONSTRAINT event_outbox_retry_count_non_negative CHECK (retry_count >= 0)
);

CREATE INDEX idx_jobs_organization_status ON jobs (organization_id, status);
CREATE INDEX idx_jobs_project_status ON jobs (project_id, status) WHERE project_id IS NOT NULL;
CREATE INDEX idx_workflow_runs_project_status ON workflow_runs (project_id, status) WHERE project_id IS NOT NULL;
CREATE INDEX idx_workflow_runs_shot_execution_run_id ON workflow_runs (shot_execution_run_id) WHERE shot_execution_run_id IS NOT NULL;
CREATE INDEX idx_workflow_steps_workflow_run_id ON workflow_steps (workflow_run_id);
CREATE INDEX idx_state_transitions_resource ON state_transitions (resource_type, resource_id);
CREATE INDEX idx_event_outbox_unpublished ON event_outbox (created_at) WHERE published_at IS NULL;
CREATE INDEX idx_event_outbox_organization_id ON event_outbox (organization_id);

COMMIT;
