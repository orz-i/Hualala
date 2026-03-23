package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
)

func (s *PostgresStore) SaveCollaborationSession(ctx context.Context, record content.CollaborationSession) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO collaboration_sessions (
			id, owner_type, owner_id, draft_version, lock_holder_user_id, lease_expires_at,
			conflict_summary, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE
		SET owner_type = EXCLUDED.owner_type,
		    owner_id = EXCLUDED.owner_id,
		    draft_version = EXCLUDED.draft_version,
		    lock_holder_user_id = EXCLUDED.lock_holder_user_id,
		    lease_expires_at = EXCLUDED.lease_expires_at,
		    conflict_summary = EXCLUDED.conflict_summary,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OwnerType, record.OwnerID, int(record.DraftVersion), emptyToNil(record.LockHolderUserID), nullableTime(record.LeaseExpiresAt), emptyToNil(record.ConflictSummary), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert collaboration session %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetCollaborationSession(ownerType string, ownerID string) (content.CollaborationSession, bool) {
	if s == nil || s.db == nil {
		return content.CollaborationSession{}, false
	}
	record := content.CollaborationSession{}
	var draftVersion int
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, owner_type, owner_id, COALESCE(draft_version, 0), COALESCE(lock_holder_user_id, ''),
		       COALESCE(lease_expires_at, '0001-01-01T00:00:00Z'::timestamptz), COALESCE(conflict_summary, ''), created_at, updated_at
		FROM collaboration_sessions
		WHERE owner_type = $1 AND owner_id = $2
		LIMIT 1
	`, strings.TrimSpace(ownerType), strings.TrimSpace(ownerID)).Scan(
		&record.ID,
		&record.OwnerType,
		&record.OwnerID,
		&draftVersion,
		&record.LockHolderUserID,
		&record.LeaseExpiresAt,
		&record.ConflictSummary,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return content.CollaborationSession{}, false
	}
	record.DraftVersion = uint32(draftVersion)
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	record.LeaseExpiresAt = record.LeaseExpiresAt.UTC()
	return record, true
}

func (s *PostgresStore) SaveCollaborationPresence(ctx context.Context, record content.CollaborationPresence) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO collaboration_presences (
			id, session_id, user_id, status, last_seen_at, lease_expires_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (session_id, user_id) DO UPDATE
		SET status = EXCLUDED.status,
		    last_seen_at = EXCLUDED.last_seen_at,
		    lease_expires_at = EXCLUDED.lease_expires_at,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.SessionID, record.UserID, defaultString(record.Status, "editing"), record.LastSeenAt, nullableTime(record.LeaseExpiresAt), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert collaboration presence %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetCollaborationPresence(sessionID string, userID string) (content.CollaborationPresence, bool) {
	if s == nil || s.db == nil {
		return content.CollaborationPresence{}, false
	}
	record := content.CollaborationPresence{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, session_id, user_id, status, last_seen_at,
		       COALESCE(lease_expires_at, '0001-01-01T00:00:00Z'::timestamptz), created_at, updated_at
		FROM collaboration_presences
		WHERE session_id = $1 AND user_id = $2
		LIMIT 1
	`, strings.TrimSpace(sessionID), strings.TrimSpace(userID)).Scan(
		&record.ID,
		&record.SessionID,
		&record.UserID,
		&record.Status,
		&record.LastSeenAt,
		&record.LeaseExpiresAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return content.CollaborationPresence{}, false
	}
	record.LastSeenAt = record.LastSeenAt.UTC()
	record.LeaseExpiresAt = record.LeaseExpiresAt.UTC()
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListCollaborationPresences(sessionID string) []content.CollaborationPresence {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id, session_id, user_id, status, last_seen_at,
		       COALESCE(lease_expires_at, '0001-01-01T00:00:00Z'::timestamptz), created_at, updated_at
		FROM collaboration_presences
		WHERE session_id = $1
		ORDER BY updated_at ASC, id ASC
	`, strings.TrimSpace(sessionID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]content.CollaborationPresence, 0)
	for rows.Next() {
		var record content.CollaborationPresence
		if err := rows.Scan(&record.ID, &record.SessionID, &record.UserID, &record.Status, &record.LastSeenAt, &record.LeaseExpiresAt, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.LastSeenAt = record.LastSeenAt.UTC()
		record.LeaseExpiresAt = record.LeaseExpiresAt.UTC()
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SavePreviewAssembly(ctx context.Context, record project.PreviewAssembly) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO preview_assemblies (
			id, project_id, episode_id, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_id = EXCLUDED.episode_id,
		    status = EXCLUDED.status,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, emptyToNil(record.EpisodeID), defaultString(record.Status, "draft"), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert preview assembly %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetPreviewAssembly(projectID string, episodeID string) (project.PreviewAssembly, bool) {
	if s == nil || s.db == nil {
		return project.PreviewAssembly{}, false
	}
	record := project.PreviewAssembly{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id, project_id, COALESCE(episode_id, ''), status, created_at, updated_at
		FROM preview_assemblies
		WHERE project_id = $1 AND COALESCE(episode_id, '') = $2
		LIMIT 1
	`, strings.TrimSpace(projectID), strings.TrimSpace(episodeID)).Scan(
		&record.ID,
		&record.ProjectID,
		&record.EpisodeID,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.PreviewAssembly{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ReplacePreviewAssemblyItems(ctx context.Context, assemblyID string, items []project.PreviewAssemblyItem) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin replace preview assembly items: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM preview_assembly_items WHERE assembly_id = $1`, strings.TrimSpace(assemblyID)); err != nil {
		return fmt.Errorf("db: clear preview assembly items %s: %w", assemblyID, err)
	}
	for _, item := range items {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO preview_assembly_items (
				id, assembly_id, shot_id, primary_asset_id, source_run_id, sequence, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, item.ID, item.AssemblyID, item.ShotID, emptyToNil(item.PrimaryAssetID), emptyToNil(item.SourceRunID), item.Sequence, item.CreatedAt, item.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert preview assembly item %s: %w", item.ID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit replace preview assembly items: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListPreviewAssemblyItems(assemblyID string) []project.PreviewAssemblyItem {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id, assembly_id, shot_id, COALESCE(primary_asset_id, ''), COALESCE(source_run_id, ''),
		       sequence, created_at, updated_at
		FROM preview_assembly_items
		WHERE assembly_id = $1
		ORDER BY sequence ASC, id ASC
	`, strings.TrimSpace(assemblyID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]project.PreviewAssemblyItem, 0)
	for rows.Next() {
		var record project.PreviewAssemblyItem
		if err := rows.Scan(&record.ID, &record.AssemblyID, &record.ShotID, &record.PrimaryAssetID, &record.SourceRunID, &record.Sequence, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}
