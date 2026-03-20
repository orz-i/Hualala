BEGIN;

CREATE TABLE evaluation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shot_execution_id uuid NOT NULL REFERENCES shot_executions(id) ON DELETE CASCADE,
    shot_execution_run_id uuid REFERENCES shot_execution_runs(id) ON DELETE SET NULL,
    evaluation_type text NOT NULL DEFAULT 'submission_gate',
    status text NOT NULL DEFAULT 'pending',
    result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    failure_codes text[] NOT NULL DEFAULT '{}'::text[],
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT evaluation_runs_status_valid CHECK (status IN ('pending', 'running', 'passed', 'failed')),
    CONSTRAINT evaluation_runs_evaluation_type_not_blank CHECK (btrim(evaluation_type) <> '')
);

CREATE TABLE shot_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shot_execution_id uuid NOT NULL REFERENCES shot_executions(id) ON DELETE CASCADE,
    shot_execution_run_id uuid REFERENCES shot_execution_runs(id) ON DELETE SET NULL,
    reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    conclusion text NOT NULL DEFAULT 'commented',
    comment_locale text NOT NULL,
    comment_body text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shot_reviews_conclusion_valid CHECK (conclusion IN ('commented', 'approved', 'rejected')),
    CONSTRAINT shot_reviews_comment_locale_not_blank CHECK (btrim(comment_locale) <> '')
);

CREATE INDEX idx_evaluation_runs_project_status ON evaluation_runs (project_id, status);
CREATE INDEX idx_evaluation_runs_shot_execution_id ON evaluation_runs (shot_execution_id);
CREATE INDEX idx_evaluation_runs_shot_execution_run_id ON evaluation_runs (shot_execution_run_id) WHERE shot_execution_run_id IS NOT NULL;
CREATE INDEX idx_shot_reviews_project_id ON shot_reviews (project_id);
CREATE INDEX idx_shot_reviews_shot_execution_id ON shot_reviews (shot_execution_id);
CREATE INDEX idx_shot_reviews_reviewer_user_id ON shot_reviews (reviewer_user_id) WHERE reviewer_user_id IS NOT NULL;

COMMIT;
