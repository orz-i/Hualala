BEGIN;

CREATE TABLE IF NOT EXISTS app_state_snapshots (
    store_key text PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT app_state_snapshots_store_key_not_blank CHECK (btrim(store_key) <> '')
);

COMMIT;
