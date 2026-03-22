BEGIN;

CREATE INDEX IF NOT EXISTS idx_event_outbox_org_created_id
    ON event_outbox (organization_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_event_outbox_org_project_created_id
    ON event_outbox (organization_id, project_id, created_at, id)
    WHERE project_id IS NOT NULL;

COMMIT;
