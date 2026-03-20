BEGIN;

CREATE TABLE import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    source_type text NOT NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT import_batches_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT import_batches_source_type_not_blank CHECK (btrim(source_type) <> '')
);

CREATE TABLE upload_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending',
    storage_provider text NOT NULL,
    bucket_name text,
    object_key_prefix text,
    expires_at timestamptz NOT NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT upload_sessions_status_valid CHECK (status IN ('pending', 'active', 'completed', 'expired', 'cancelled')),
    CONSTRAINT upload_sessions_storage_provider_not_blank CHECK (btrim(storage_provider) <> '')
);

CREATE TABLE upload_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_session_id uuid NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    original_file_name text NOT NULL,
    mime_type text,
    file_size_bytes bigint,
    checksum_sha256 text,
    storage_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    uploaded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT upload_files_storage_key_unique UNIQUE (storage_key),
    CONSTRAINT upload_files_status_valid CHECK (status IN ('pending', 'uploaded', 'verified', 'failed')),
    CONSTRAINT upload_files_original_file_name_not_blank CHECK (btrim(original_file_name) <> ''),
    CONSTRAINT upload_files_storage_key_not_blank CHECK (btrim(storage_key) <> ''),
    CONSTRAINT upload_files_file_size_non_negative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

CREATE TABLE media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
    upload_file_id uuid REFERENCES upload_files(id) ON DELETE SET NULL,
    asset_type text NOT NULL,
    source_type text NOT NULL,
    title text,
    storage_key text NOT NULL,
    mime_type text,
    file_size_bytes bigint,
    ai_disclosure_status text NOT NULL DEFAULT 'unknown',
    rights_status text NOT NULL DEFAULT 'unknown',
    consent_status text NOT NULL DEFAULT 'unknown',
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT media_assets_storage_key_unique UNIQUE (storage_key),
    CONSTRAINT media_assets_asset_type_valid CHECK (asset_type IN ('image', 'video', 'audio', 'document', 'other')),
    CONSTRAINT media_assets_ai_disclosure_status_valid CHECK (ai_disclosure_status IN ('unknown', 'not_required', 'required', 'completed')),
    CONSTRAINT media_assets_rights_status_valid CHECK (rights_status IN ('unknown', 'clear', 'restricted', 'expired')),
    CONSTRAINT media_assets_consent_status_valid CHECK (consent_status IN ('unknown', 'not_required', 'granted', 'denied')),
    CONSTRAINT media_assets_source_type_not_blank CHECK (btrim(source_type) <> ''),
    CONSTRAINT media_assets_storage_key_not_blank CHECK (btrim(storage_key) <> ''),
    CONSTRAINT media_assets_file_size_non_negative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

CREATE TABLE media_asset_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    variant_type text NOT NULL,
    storage_key text NOT NULL,
    mime_type text,
    file_size_bytes bigint,
    width integer,
    height integer,
    duration_ms integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT media_asset_variants_asset_variant_unique UNIQUE (media_asset_id, variant_type),
    CONSTRAINT media_asset_variants_storage_key_unique UNIQUE (storage_key),
    CONSTRAINT media_asset_variants_variant_type_not_blank CHECK (btrim(variant_type) <> ''),
    CONSTRAINT media_asset_variants_storage_key_not_blank CHECK (btrim(storage_key) <> ''),
    CONSTRAINT media_asset_variants_file_size_non_negative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    CONSTRAINT media_asset_variants_width_positive CHECK (width IS NULL OR width > 0),
    CONSTRAINT media_asset_variants_height_positive CHECK (height IS NULL OR height > 0),
    CONSTRAINT media_asset_variants_duration_non_negative CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX idx_import_batches_project_status ON import_batches (project_id, status);
CREATE INDEX idx_upload_sessions_project_status ON upload_sessions (project_id, status) WHERE project_id IS NOT NULL;
CREATE INDEX idx_upload_sessions_import_batch_id ON upload_sessions (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX idx_upload_files_upload_session_id ON upload_files (upload_session_id);
CREATE INDEX idx_media_assets_project_source_type ON media_assets (project_id, source_type);
CREATE INDEX idx_media_assets_import_batch_id ON media_assets (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX idx_media_assets_upload_file_id ON media_assets (upload_file_id) WHERE upload_file_id IS NOT NULL;
CREATE INDEX idx_media_asset_variants_media_asset_id ON media_asset_variants (media_asset_id);

COMMIT;
