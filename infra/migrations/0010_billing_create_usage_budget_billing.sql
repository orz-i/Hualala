BEGIN;

CREATE TABLE budget_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    policy_name text NOT NULL,
    policy_mode text NOT NULL DEFAULT 'hard_stop',
    currency_code text NOT NULL,
    max_budget_units bigint NOT NULL,
    alert_threshold_units bigint,
    status text NOT NULL DEFAULT 'active',
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT budget_policies_project_name_unique UNIQUE (project_id, policy_name),
    CONSTRAINT budget_policies_policy_name_not_blank CHECK (btrim(policy_name) <> ''),
    CONSTRAINT budget_policies_policy_mode_valid CHECK (policy_mode IN ('observe', 'soft_stop', 'hard_stop')),
    CONSTRAINT budget_policies_currency_code_not_blank CHECK (btrim(currency_code) <> ''),
    CONSTRAINT budget_policies_max_budget_non_negative CHECK (max_budget_units >= 0),
    CONSTRAINT budget_policies_alert_threshold_non_negative CHECK (alert_threshold_units IS NULL OR alert_threshold_units >= 0),
    CONSTRAINT budget_policies_status_valid CHECK (status IN ('active', 'paused', 'archived'))
);

CREATE TABLE usage_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shot_execution_run_id uuid REFERENCES shot_execution_runs(id) ON DELETE SET NULL,
    workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
    model_profile_id uuid REFERENCES model_profiles(id) ON DELETE SET NULL,
    usage_type text NOT NULL,
    input_units bigint NOT NULL DEFAULT 0,
    output_units bigint NOT NULL DEFAULT 0,
    total_cost_units bigint NOT NULL DEFAULT 0,
    currency_code text NOT NULL,
    external_request_id text,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usage_records_usage_type_not_blank CHECK (btrim(usage_type) <> ''),
    CONSTRAINT usage_records_currency_code_not_blank CHECK (btrim(currency_code) <> ''),
    CONSTRAINT usage_records_input_units_non_negative CHECK (input_units >= 0),
    CONSTRAINT usage_records_output_units_non_negative CHECK (output_units >= 0),
    CONSTRAINT usage_records_total_cost_units_non_negative CHECK (total_cost_units >= 0)
);

CREATE TABLE billing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    usage_record_id uuid REFERENCES usage_records(id) ON DELETE SET NULL,
    budget_policy_id uuid REFERENCES budget_policies(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    severity text NOT NULL DEFAULT 'info',
    message_key text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_events_event_type_not_blank CHECK (btrim(event_type) <> ''),
    CONSTRAINT billing_events_message_key_not_blank CHECK (btrim(message_key) <> ''),
    CONSTRAINT billing_events_severity_valid CHECK (severity IN ('info', 'warning', 'error'))
);

CREATE INDEX idx_budget_policies_project_status ON budget_policies (project_id, status);
CREATE INDEX idx_usage_records_project_recorded_at ON usage_records (project_id, recorded_at DESC);
CREATE INDEX idx_usage_records_shot_execution_run_id ON usage_records (shot_execution_run_id) WHERE shot_execution_run_id IS NOT NULL;
CREATE INDEX idx_usage_records_workflow_run_id ON usage_records (workflow_run_id) WHERE workflow_run_id IS NOT NULL;
CREATE INDEX idx_billing_events_project_created_at ON billing_events (project_id, created_at DESC);
CREATE INDEX idx_billing_events_budget_policy_id ON billing_events (budget_policy_id) WHERE budget_policy_id IS NOT NULL;
CREATE INDEX idx_billing_events_usage_record_id ON billing_events (usage_record_id) WHERE usage_record_id IS NOT NULL;

COMMIT;
