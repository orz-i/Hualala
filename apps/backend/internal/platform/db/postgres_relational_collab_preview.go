package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
)

func (p *PostgresPersister) loadCollaborationAndPreview(ctx context.Context, snapshot *Snapshot) error {
	sessionRows, err := p.db.QueryContext(ctx, `
		SELECT id, owner_type, owner_id, COALESCE(draft_version, 0), COALESCE(lock_holder_user_id, ''),
		       COALESCE(lease_expires_at, '0001-01-01T00:00:00Z'::timestamptz), COALESCE(conflict_summary, ''),
		       created_at, updated_at
		FROM collaboration_sessions
	`)
	if err != nil {
		return fmt.Errorf("db: load collaboration sessions: %w", err)
	}
	defer sessionRows.Close()
	for sessionRows.Next() {
		var (
			record       content.CollaborationSession
			draftVersion int
		)
		if err := sessionRows.Scan(&record.ID, &record.OwnerType, &record.OwnerID, &draftVersion, &record.LockHolderUserID, &record.LeaseExpiresAt, &record.ConflictSummary, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan collaboration session: %w", err)
		}
		record.DraftVersion = uint32(draftVersion)
		record.LeaseExpiresAt = record.LeaseExpiresAt.UTC()
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.CollaborationSessions[record.ID] = record
	}
	if err := sessionRows.Err(); err != nil {
		return fmt.Errorf("db: iterate collaboration sessions: %w", err)
	}

	presenceRows, err := p.db.QueryContext(ctx, `
		SELECT id, session_id, user_id, status, last_seen_at,
		       COALESCE(lease_expires_at, '0001-01-01T00:00:00Z'::timestamptz), created_at, updated_at
		FROM collaboration_presences
	`)
	if err != nil {
		return fmt.Errorf("db: load collaboration presences: %w", err)
	}
	defer presenceRows.Close()
	for presenceRows.Next() {
		var record content.CollaborationPresence
		if err := presenceRows.Scan(&record.ID, &record.SessionID, &record.UserID, &record.Status, &record.LastSeenAt, &record.LeaseExpiresAt, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan collaboration presence: %w", err)
		}
		record.LastSeenAt = record.LastSeenAt.UTC()
		record.LeaseExpiresAt = record.LeaseExpiresAt.UTC()
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.CollaborationPresences[record.ID] = record
	}
	if err := presenceRows.Err(); err != nil {
		return fmt.Errorf("db: iterate collaboration presences: %w", err)
	}

	assemblyRows, err := p.db.QueryContext(ctx, `
		SELECT id, project_id, COALESCE(episode_id, ''), status, created_at, updated_at
		FROM preview_assemblies
	`)
	if err != nil {
		return fmt.Errorf("db: load preview assemblies: %w", err)
	}
	defer assemblyRows.Close()
	for assemblyRows.Next() {
		var record project.PreviewAssembly
		if err := assemblyRows.Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan preview assembly: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.PreviewAssemblies[record.ID] = record
	}
	if err := assemblyRows.Err(); err != nil {
		return fmt.Errorf("db: iterate preview assemblies: %w", err)
	}

	itemRows, err := p.db.QueryContext(ctx, `
		SELECT id, assembly_id, shot_id, COALESCE(primary_asset_id, ''), COALESCE(source_run_id, ''),
		       sequence, created_at, updated_at
		FROM preview_assembly_items
	`)
	if err != nil {
		return fmt.Errorf("db: load preview assembly items: %w", err)
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var record project.PreviewAssemblyItem
		if err := itemRows.Scan(&record.ID, &record.AssemblyID, &record.ShotID, &record.PrimaryAssetID, &record.SourceRunID, &record.Sequence, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan preview assembly item: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.PreviewAssemblyItems[record.ID] = record
	}
	if err := itemRows.Err(); err != nil {
		return fmt.Errorf("db: iterate preview assembly items: %w", err)
	}

	updateCounter(&snapshot.NextCollaborationID, "collaboration-session-", snapshot.CollaborationSessions)
	updateCounter(&snapshot.NextPresenceID, "collaboration-presence-", snapshot.CollaborationPresences)
	updateCounter(&snapshot.NextPreviewAssemblyID, "preview-assembly-", snapshot.PreviewAssemblies)
	updateCounter(&snapshot.NextPreviewItemID, "preview-assembly-item-", snapshot.PreviewAssemblyItems)

	return nil
}

func (p *PostgresPersister) saveCollaborationAndPreview(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.CollaborationSessions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO collaboration_sessions (
				id, owner_type, owner_id, draft_version, lock_holder_user_id, lease_expires_at,
				conflict_summary, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, record.ID, record.OwnerType, record.OwnerID, int(record.DraftVersion), emptyToNil(record.LockHolderUserID), nullableTime(record.LeaseExpiresAt), emptyToNil(record.ConflictSummary), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert collaboration session %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.CollaborationPresences {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO collaboration_presences (
				id, session_id, user_id, status, last_seen_at, lease_expires_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, record.ID, record.SessionID, record.UserID, defaultString(record.Status, "editing"), record.LastSeenAt, nullableTime(record.LeaseExpiresAt), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert collaboration presence %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.PreviewAssemblies {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO preview_assemblies (
				id, project_id, episode_id, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6)
		`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), defaultString(record.Status, "draft"), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert preview assembly %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.PreviewAssemblyItems {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO preview_assembly_items (
				id, assembly_id, shot_id, primary_asset_id, source_run_id, sequence, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, record.ID, record.AssemblyID, record.ShotID, emptyToNil(record.PrimaryAssetID), emptyToNil(record.SourceRunID), record.Sequence, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert preview assembly item %s: %w", record.ID, err)
		}
	}

	return nil
}

func updateCounter[T any](target *int, prefix string, records map[string]T) {
	if len(records) == 0 {
		return
	}
	maxValue := *target
	for id := range records {
		var parsed int
		if _, err := fmt.Sscanf(id, prefix+"%d", &parsed); err == nil && parsed > maxValue {
			maxValue = parsed
		}
	}
	*target = maxValue
}
