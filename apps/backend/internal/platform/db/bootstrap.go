package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const (
	DefaultDevOrganizationID = "11111111-1111-1111-1111-111111111111"
	DefaultDevUserID         = "22222222-2222-2222-2222-222222222222"
	DefaultDevRoleID         = "33333333-3333-3333-3333-333333333333"
	DefaultDevMembershipID   = "44444444-4444-4444-4444-444444444444"
)

type DevBootstrapResult struct {
	OrganizationID string `json:"organization_id"`
	UserID         string `json:"user_id"`
	RoleID         string `json:"role_id"`
	MembershipID   string `json:"membership_id"`
}

func (r DevBootstrapResult) JSON() string {
	body, _ := json.Marshal(r)
	return string(body)
}

func EnsureDevBootstrap(ctx context.Context, handle *sql.DB) (DevBootstrapResult, error) {
	if handle == nil {
		return DevBootstrapResult{}, errors.New("db: database handle is required for bootstrap")
	}

	tx, err := handle.BeginTx(ctx, nil)
	if err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: begin bootstrap tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO organizations (id, slug, display_name, default_ui_locale, default_content_locale)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE
		SET slug = EXCLUDED.slug,
		    display_name = EXCLUDED.display_name,
		    default_ui_locale = EXCLUDED.default_ui_locale,
		    default_content_locale = EXCLUDED.default_content_locale,
		    updated_at = now()
	`, DefaultDevOrganizationID, "dev-org", "Development Organization", "zh-CN", "zh-CN"); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: upsert organization: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, email, display_name, preferred_ui_locale)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
		    display_name = EXCLUDED.display_name,
		    preferred_ui_locale = EXCLUDED.preferred_ui_locale,
		    updated_at = now()
	`, DefaultDevUserID, "dev-user@hualala.local", "Development Operator", "zh-CN"); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: upsert user: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO roles (id, organization_id, role_code, display_name)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    role_code = EXCLUDED.role_code,
		    display_name = EXCLUDED.display_name,
		    updated_at = now()
	`, DefaultDevRoleID, DefaultDevOrganizationID, "admin", "Administrator"); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: upsert role: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO memberships (id, organization_id, user_id, role_id, membership_status)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    user_id = EXCLUDED.user_id,
		    role_id = EXCLUDED.role_id,
		    membership_status = EXCLUDED.membership_status,
		    updated_at = now()
	`, DefaultDevMembershipID, DefaultDevOrganizationID, DefaultDevUserID, DefaultDevRoleID, "active"); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: upsert membership: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: commit bootstrap tx: %w", err)
	}

	return DevBootstrapResult{
		OrganizationID: DefaultDevOrganizationID,
		UserID:         DefaultDevUserID,
		RoleID:         DefaultDevRoleID,
		MembershipID:   DefaultDevMembershipID,
	}, nil
}

func EnsureDevBootstrapWithURL(ctx context.Context, databaseURL string) (DevBootstrapResult, error) {
	if strings.TrimSpace(databaseURL) == "" {
		return DevBootstrapResult{}, errors.New("db: database_url is required for bootstrap")
	}

	handle, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: open bootstrap postgres: %w", err)
	}
	defer handle.Close()

	if err := handle.PingContext(ctx); err != nil {
		return DevBootstrapResult{}, fmt.Errorf("db: ping bootstrap postgres: %w", err)
	}

	return EnsureDevBootstrap(ctx, handle)
}
