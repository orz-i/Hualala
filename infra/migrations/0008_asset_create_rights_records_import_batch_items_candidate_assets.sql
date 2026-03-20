BEGIN;

CREATE TABLE rights_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    license_type text NOT NULL,
    license_scope text NOT NULL,
    rights_status text NOT NULL,
    consent_status text NOT NULL DEFAULT 'unknown',
    rights_holder text,
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rights_records_asset_license_scope_unique UNIQUE (media_asset_id, license_scope),
    CONSTRAINT rights_records_license_type_not_blank CHECK (btrim(license_type) <> ''),
    CONSTRAINT rights_records_license_scope_not_blank CHECK (btrim(license_scope) <> ''),
    CONSTRAINT rights_records_rights_status_valid CHECK (rights_status IN ('unknown', 'clear', 'restricted', 'expired')),
    CONSTRAINT rights_records_consent_status_valid CHECK (consent_status IN ('unknown', 'not_required', 'granted', 'denied'))
);

CREATE TABLE import_batch_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    upload_file_id uuid REFERENCES upload_files(id) ON DELETE SET NULL,
    media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
    matched_shot_id uuid REFERENCES shots(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'parsed',
    confidence_score numeric(5,4),
    parsed_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    CONSTRAINT import_batch_items_status_valid CHECK (status IN ('parsed', 'matched', 'pending_review', 'confirmed', 'rejected')),
    CONSTRAINT import_batch_items_confidence_score_range CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE TABLE shot_candidate_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shot_execution_id uuid NOT NULL REFERENCES shot_executions(id) ON DELETE CASCADE,
    media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    source_run_id uuid REFERENCES shot_execution_runs(id) ON DELETE SET NULL,
    source_import_batch_item_id uuid REFERENCES import_batch_items(id) ON DELETE SET NULL,
    candidate_rank integer,
    selection_status text NOT NULL DEFAULT 'candidate',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shot_candidate_assets_execution_asset_unique UNIQUE (shot_execution_id, media_asset_id),
    CONSTRAINT shot_candidate_assets_candidate_rank_positive CHECK (candidate_rank IS NULL OR candidate_rank > 0),
    CONSTRAINT shot_candidate_assets_selection_status_valid CHECK (selection_status IN ('candidate', 'selected_primary', 'rejected'))
);

CREATE INDEX idx_rights_records_media_asset_id ON rights_records (media_asset_id);
CREATE INDEX idx_rights_records_rights_status ON rights_records (rights_status);
CREATE INDEX idx_import_batch_items_import_batch_status ON import_batch_items (import_batch_id, status);
CREATE INDEX idx_import_batch_items_matched_shot_id ON import_batch_items (matched_shot_id) WHERE matched_shot_id IS NOT NULL;
CREATE INDEX idx_import_batch_items_media_asset_id ON import_batch_items (media_asset_id) WHERE media_asset_id IS NOT NULL;
CREATE INDEX idx_shot_candidate_assets_execution_id ON shot_candidate_assets (shot_execution_id);
CREATE INDEX idx_shot_candidate_assets_media_asset_id ON shot_candidate_assets (media_asset_id);
CREATE INDEX idx_shot_candidate_assets_selection_status ON shot_candidate_assets (selection_status);

COMMIT;
