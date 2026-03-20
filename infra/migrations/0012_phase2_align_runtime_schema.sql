BEGIN;

ALTER TABLE shots
    ADD COLUMN IF NOT EXISTS code text,
    ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE upload_sessions
    ADD COLUMN IF NOT EXISTS file_name text,
    ADD COLUMN IF NOT EXISTS checksum_sha256 text,
    ADD COLUMN IF NOT EXISTS size_bytes bigint,
    ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resume_hint text,
    ADD COLUMN IF NOT EXISTS last_retry_at timestamptz;

ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS locale text,
    ADD COLUMN IF NOT EXISTS ai_annotated boolean NOT NULL DEFAULT false;

ALTER TABLE import_batches
    DROP CONSTRAINT IF EXISTS import_batches_status_valid;
ALTER TABLE import_batches
    ADD CONSTRAINT import_batches_status_valid CHECK (
        status IN (
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'pending_review',
            'confirmed',
            'uploaded_pending_match',
            'matched_pending_confirm'
        )
    );

ALTER TABLE import_batch_items
    DROP CONSTRAINT IF EXISTS import_batch_items_status_valid;
ALTER TABLE import_batch_items
    ADD CONSTRAINT import_batch_items_status_valid CHECK (
        status IN (
            'parsed',
            'matched',
            'pending_review',
            'confirmed',
            'rejected',
            'uploaded_pending_match',
            'matched_pending_confirm'
        )
    );

COMMIT;
