package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/lib/pq"
)

func (s *PostgresStore) GetOrganization(orgID string) (org.Organization, bool) {
	if s == nil || s.db == nil {
		return org.Organization{}, false
	}
	record := org.Organization{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, slug, display_name, default_ui_locale, default_content_locale
		FROM organizations
		WHERE id = $1
	`, strings.TrimSpace(orgID)).Scan(
		&record.ID,
		&record.Slug,
		&record.DisplayName,
		&record.DefaultUILocale,
		&record.DefaultContentLocale,
	)
	if err != nil {
		return org.Organization{}, false
	}
	return record, true
}

func (s *PostgresStore) SaveOrganization(ctx context.Context, record org.Organization) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO organizations (
			id, slug, display_name, default_ui_locale, default_content_locale, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET slug = EXCLUDED.slug,
		    display_name = EXCLUDED.display_name,
		    default_ui_locale = EXCLUDED.default_ui_locale,
		    default_content_locale = EXCLUDED.default_content_locale,
		    updated_at = NOW()
	`, record.ID, record.Slug, record.DisplayName, record.DefaultUILocale, record.DefaultContentLocale)
	if err != nil {
		return fmt.Errorf("db: upsert organization %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetUser(userID string) (auth.User, bool) {
	if s == nil || s.db == nil {
		return auth.User{}, false
	}
	record := auth.User{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, email, display_name, preferred_ui_locale, COALESCE(timezone, '')
		FROM users
		WHERE id = $1
	`, strings.TrimSpace(userID)).Scan(
		&record.ID,
		&record.Email,
		&record.DisplayName,
		&record.PreferredUILocale,
		&record.Timezone,
	)
	if err != nil {
		return auth.User{}, false
	}
	return record, true
}

func (s *PostgresStore) SaveUser(ctx context.Context, record auth.User) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO users (
			id, email, display_name, preferred_ui_locale, timezone, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
		    display_name = EXCLUDED.display_name,
		    preferred_ui_locale = EXCLUDED.preferred_ui_locale,
		    timezone = EXCLUDED.timezone,
		    updated_at = NOW()
	`, record.ID, record.Email, record.DisplayName, record.PreferredUILocale, emptyToNil(record.Timezone))
	if err != nil {
		return fmt.Errorf("db: upsert user %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetMembership(memberID string) (org.Member, bool) {
	if s == nil || s.db == nil {
		return org.Member{}, false
	}
	record := org.Member{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, user_id::text, COALESCE(role_id::text, ''), membership_status
		FROM memberships
		WHERE id = $1
	`, strings.TrimSpace(memberID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.UserID,
		&record.RoleID,
		&record.Status,
	)
	if err != nil {
		return org.Member{}, false
	}
	return record, true
}

func (s *PostgresStore) FindMembership(orgID string, userID string) (org.Member, bool) {
	if s == nil || s.db == nil {
		return org.Member{}, false
	}
	record := org.Member{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, user_id::text, COALESCE(role_id::text, ''), membership_status
		FROM memberships
		WHERE organization_id = $1 AND user_id = $2
		ORDER BY id
		LIMIT 1
	`, strings.TrimSpace(orgID), strings.TrimSpace(userID)).Scan(
		&record.ID,
		&record.OrgID,
		&record.UserID,
		&record.RoleID,
		&record.Status,
	)
	if err != nil {
		return org.Member{}, false
	}
	return record, true
}

func (s *PostgresStore) ListMembersByOrganization(orgID string) []org.Member {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, user_id::text, COALESCE(role_id::text, ''), membership_status
		FROM memberships
		WHERE organization_id = $1
		ORDER BY id
	`, strings.TrimSpace(orgID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]org.Member, 0)
	for rows.Next() {
		var record org.Member
		if err := rows.Scan(&record.ID, &record.OrgID, &record.UserID, &record.RoleID, &record.Status); err != nil {
			return nil
		}
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveMembership(ctx context.Context, record org.Member) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO memberships (
			id, organization_id, user_id, role_id, membership_status, joined_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    user_id = EXCLUDED.user_id,
		    role_id = EXCLUDED.role_id,
		    membership_status = EXCLUDED.membership_status,
		    updated_at = NOW()
	`, record.ID, record.OrgID, record.UserID, nullableUUID(record.RoleID), defaultString(record.Status, "active"))
	if err != nil {
		return fmt.Errorf("db: upsert membership %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetRole(roleID string) (org.Role, bool) {
	if s == nil || s.db == nil {
		return org.Role{}, false
	}
	record := org.Role{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, role_code, display_name
		FROM roles
		WHERE id = $1
	`, strings.TrimSpace(roleID)).Scan(&record.ID, &record.OrgID, &record.Code, &record.DisplayName)
	if err != nil {
		return org.Role{}, false
	}
	return record, true
}

func (s *PostgresStore) ListRolesByOrganization(orgID string) []org.Role {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, role_code, display_name
		FROM roles
		WHERE organization_id = $1
		ORDER BY id
	`, strings.TrimSpace(orgID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]org.Role, 0)
	for rows.Next() {
		var record org.Role
		if err := rows.Scan(&record.ID, &record.OrgID, &record.Code, &record.DisplayName); err != nil {
			return nil
		}
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveRole(ctx context.Context, record org.Role) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO roles (
			id, organization_id, role_code, display_name, created_at, updated_at
		) VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    role_code = EXCLUDED.role_code,
		    display_name = EXCLUDED.display_name,
		    updated_at = NOW()
	`, record.ID, record.OrgID, record.Code, record.DisplayName)
	if err != nil {
		return fmt.Errorf("db: upsert role %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) DeleteRole(ctx context.Context, roleID string) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM roles WHERE id = $1`, strings.TrimSpace(roleID)); err != nil {
		return fmt.Errorf("db: delete role %s: %w", roleID, err)
	}
	return nil
}

func (s *PostgresStore) ListRolePermissions(roleID string) []string {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT permission_code
		FROM role_permissions
		WHERE role_id = $1
		ORDER BY permission_code
	`, strings.TrimSpace(roleID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil
		}
		items = append(items, permission)
	}
	return items
}

func (s *PostgresStore) ReplaceRolePermissions(ctx context.Context, roleID string, permissions []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin replace role permissions: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, strings.TrimSpace(roleID)); err != nil {
		return fmt.Errorf("db: clear role permissions %s: %w", roleID, err)
	}
	for _, permission := range permissions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO role_permissions (role_id, permission_code, created_at)
			VALUES ($1, $2, NOW())
		`, strings.TrimSpace(roleID), permission); err != nil {
			return fmt.Errorf("db: insert role permission %s/%s: %w", roleID, permission, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit replace role permissions: %w", err)
	}
	return nil
}

func (s *PostgresStore) SaveProject(ctx context.Context, record project.Project) error {
	supportedLocales := append([]string(nil), record.SupportedContentLocales...)
	if len(supportedLocales) == 0 {
		locale := strings.TrimSpace(record.PrimaryContentLocale)
		if locale == "" {
			locale = "zh-CN"
		}
		supportedLocales = []string{locale}
	}
	primaryLocale := strings.TrimSpace(record.PrimaryContentLocale)
	if primaryLocale == "" {
		primaryLocale = supportedLocales[0]
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO projects (
			id, organization_id, owner_user_id, title, status, current_stage,
			primary_content_locale, supported_content_locales, settings, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $10)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    owner_user_id = EXCLUDED.owner_user_id,
		    title = EXCLUDED.title,
		    status = EXCLUDED.status,
		    current_stage = EXCLUDED.current_stage,
		    primary_content_locale = EXCLUDED.primary_content_locale,
		    supported_content_locales = EXCLUDED.supported_content_locales,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OrganizationID, record.OwnerUserID, record.Title, defaultString(record.Status, "draft"), defaultString(record.CurrentStage, "planning"), primaryLocale, pq.Array(supportedLocales), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert project %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetProject(projectID string) (project.Project, bool) {
	if s == nil || s.db == nil {
		return project.Project{}, false
	}
	record := project.Project{}
	var supported pq.StringArray
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, owner_user_id::text, title, status, current_stage,
		       primary_content_locale, supported_content_locales, created_at, updated_at
		FROM projects
		WHERE id = $1
	`, strings.TrimSpace(projectID)).Scan(
		&record.ID,
		&record.OrganizationID,
		&record.OwnerUserID,
		&record.Title,
		&record.Status,
		&record.CurrentStage,
		&record.PrimaryContentLocale,
		&supported,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return project.Project{}, false
	}
	record.SupportedContentLocales = append([]string(nil), supported...)
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListProjectsByOrganization(organizationID string) []project.Project {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, owner_user_id::text, title, status, current_stage,
		       primary_content_locale, supported_content_locales, created_at, updated_at
		FROM projects
		WHERE organization_id = $1
		ORDER BY created_at ASC, id ASC
	`, strings.TrimSpace(organizationID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]project.Project, 0)
	for rows.Next() {
		var record project.Project
		var supported pq.StringArray
		if err := rows.Scan(&record.ID, &record.OrganizationID, &record.OwnerUserID, &record.Title, &record.Status, &record.CurrentStage, &record.PrimaryContentLocale, &supported, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.SupportedContentLocales = append([]string(nil), supported...)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveEpisode(ctx context.Context, record project.Episode) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO episodes (
			id, project_id, episode_no, title, lifecycle_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'draft', $5, $6)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_no = EXCLUDED.episode_no,
		    title = EXCLUDED.title,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, record.EpisodeNo, record.Title, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert episode %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetEpisode(episodeID string) (project.Episode, bool) {
	if s == nil || s.db == nil {
		return project.Episode{}, false
	}
	record := project.Episode{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, project_id::text, episode_no, title, created_at, updated_at
		FROM episodes
		WHERE id = $1
	`, strings.TrimSpace(episodeID)).Scan(&record.ID, &record.ProjectID, &record.EpisodeNo, &record.Title, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return project.Episode{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListEpisodesByProject(projectID string) []project.Episode {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, project_id::text, episode_no, title, created_at, updated_at
		FROM episodes
		WHERE project_id = $1
		ORDER BY episode_no ASC, id ASC
	`, strings.TrimSpace(projectID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]project.Episode, 0)
	for rows.Next() {
		var record project.Episode
		if err := rows.Scan(&record.ID, &record.ProjectID, &record.EpisodeNo, &record.Title, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveScene(ctx context.Context, record content.Scene) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO scenes (
			id, project_id, episode_id, scene_no, title, source_locale, lifecycle_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET project_id = EXCLUDED.project_id,
		    episode_id = EXCLUDED.episode_id,
		    scene_no = EXCLUDED.scene_no,
		    title = EXCLUDED.title,
		    source_locale = EXCLUDED.source_locale,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.ProjectID, record.EpisodeID, record.SceneNo, record.Title, emptyToNil(record.SourceLocale), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert scene %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetScene(sceneID string) (content.Scene, bool) {
	if s == nil || s.db == nil {
		return content.Scene{}, false
	}
	record := content.Scene{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, project_id::text, episode_id::text, scene_no, title, COALESCE(source_locale, ''), created_at, updated_at
		FROM scenes
		WHERE id = $1
	`, strings.TrimSpace(sceneID)).Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.SceneNo, &record.Title, &record.SourceLocale, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return content.Scene{}, false
	}
	record.Code = fmt.Sprintf("SCENE-%03d", record.SceneNo)
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListScenes(projectID string, episodeID string) []content.Scene {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, project_id::text, episode_id::text, scene_no, title, COALESCE(source_locale, ''), created_at, updated_at
		FROM scenes
		WHERE project_id = $1 AND episode_id = $2
		ORDER BY scene_no ASC, id ASC
	`, strings.TrimSpace(projectID), strings.TrimSpace(episodeID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]content.Scene, 0)
	for rows.Next() {
		var record content.Scene
		if err := rows.Scan(&record.ID, &record.ProjectID, &record.EpisodeID, &record.SceneNo, &record.Title, &record.SourceLocale, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.Code = fmt.Sprintf("SCENE-%03d", record.SceneNo)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveShot(ctx context.Context, record content.Shot) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shots (
			id, scene_id, shot_no, code, title, source_locale, lifecycle_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET scene_id = EXCLUDED.scene_id,
		    shot_no = EXCLUDED.shot_no,
		    code = EXCLUDED.code,
		    title = EXCLUDED.title,
		    source_locale = EXCLUDED.source_locale,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.SceneID, record.ShotNo, emptyToNil(record.Code), emptyToNil(record.Title), emptyToNil(record.SourceLocale), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert shot %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetShot(shotID string) (content.Shot, bool) {
	if s == nil || s.db == nil {
		return content.Shot{}, false
	}
	record := content.Shot{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, scene_id::text, shot_no, COALESCE(code, ''), COALESCE(title, ''), COALESCE(source_locale, ''), created_at, updated_at
		FROM shots
		WHERE id = $1
	`, strings.TrimSpace(shotID)).Scan(&record.ID, &record.SceneID, &record.ShotNo, &record.Code, &record.Title, &record.SourceLocale, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return content.Shot{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) GetCollaborationScope(ownerType string, ownerID string) (string, string, error) {
	if s == nil || s.db == nil {
		return "", "", fmt.Errorf("db: collaboration scope store unavailable")
	}

	normalizedType := strings.TrimSpace(ownerType)
	normalizedID := strings.TrimSpace(ownerID)
	var query string
	switch normalizedType {
	case "project":
		query = `
			SELECT organization_id::text, id::text
			FROM projects
			WHERE id = $1
		`
	case "episode":
		query = `
			SELECT p.organization_id::text, p.id::text
			FROM episodes e
			JOIN projects p ON p.id = e.project_id
			WHERE e.id = $1
		`
	case "scene":
		query = `
			SELECT p.organization_id::text, p.id::text
			FROM scenes s
			JOIN projects p ON p.id = s.project_id
			WHERE s.id = $1
		`
	case "shot":
		query = `
			SELECT p.organization_id::text, p.id::text
			FROM shots sh
			JOIN scenes s ON s.id = sh.scene_id
			JOIN projects p ON p.id = s.project_id
			WHERE sh.id = $1
		`
	default:
		return "", "", fmt.Errorf("db: owner_type %q is invalid", normalizedType)
	}

	var organizationID string
	var projectID string
	if err := s.db.QueryRowContext(context.Background(), query, normalizedID).Scan(&organizationID, &projectID); err != nil {
		return "", "", fmt.Errorf("db: %s %q not found", normalizedType, normalizedID)
	}
	return organizationID, projectID, nil
}

func (s *PostgresStore) ListShotsByScene(sceneID string) []content.Shot {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, scene_id::text, shot_no, COALESCE(code, ''), COALESCE(title, ''), COALESCE(source_locale, ''), created_at, updated_at
		FROM shots
		WHERE scene_id = $1
		ORDER BY shot_no ASC, id ASC
	`, strings.TrimSpace(sceneID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]content.Shot, 0)
	for rows.Next() {
		var record content.Shot
		if err := rows.Scan(&record.ID, &record.SceneID, &record.ShotNo, &record.Code, &record.Title, &record.SourceLocale, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveSnapshot(ctx context.Context, record content.Snapshot) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO content_snapshots (
			id, resource_type, resource_id, snapshot_kind, locale, translation_group_id,
			source_snapshot_id, translation_status, body, created_at, updated_at
		) VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE
		SET resource_type = EXCLUDED.resource_type,
		    resource_id = EXCLUDED.resource_id,
		    locale = EXCLUDED.locale,
		    translation_group_id = EXCLUDED.translation_group_id,
		    source_snapshot_id = EXCLUDED.source_snapshot_id,
		    translation_status = EXCLUDED.translation_status,
		    body = EXCLUDED.body,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OwnerType, record.OwnerID, record.Locale, normalizeSnapshotGroupID(record.TranslationGroupID), nullableUUID(record.SourceSnapshotID), defaultString(record.TranslationStatus, "source"), record.Body, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert content snapshot %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetSnapshot(snapshotID string) (content.Snapshot, bool) {
	if s == nil || s.db == nil {
		return content.Snapshot{}, false
	}
	record := content.Snapshot{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, resource_type, resource_id::text, locale,
		       COALESCE(source_snapshot_id::text, ''), translation_group_id::text,
		       translation_status, body, created_at, updated_at
		FROM content_snapshots
		WHERE id = $1
	`, strings.TrimSpace(snapshotID)).Scan(
		&record.ID,
		&record.OwnerType,
		&record.OwnerID,
		&record.Locale,
		&record.SourceSnapshotID,
		&record.TranslationGroupID,
		&record.TranslationStatus,
		&record.Body,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return content.Snapshot{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	return record, true
}

func (s *PostgresStore) ListSnapshotsByOwner(ownerType string, ownerID string) []content.Snapshot {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, resource_type, resource_id::text, locale,
		       COALESCE(source_snapshot_id::text, ''), translation_group_id::text,
		       translation_status, body, created_at, updated_at
		FROM content_snapshots
		WHERE resource_type = $1 AND resource_id = $2
		ORDER BY id ASC
	`, strings.TrimSpace(ownerType), strings.TrimSpace(ownerID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]content.Snapshot, 0)
	for rows.Next() {
		var record content.Snapshot
		if err := rows.Scan(&record.ID, &record.OwnerType, &record.OwnerID, &record.Locale, &record.SourceSnapshotID, &record.TranslationGroupID, &record.TranslationStatus, &record.Body, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}
