package authz

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAuthorizerResolvePrincipalRejectsMissingIdentity(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthorizerStore(store)
	authorizer := NewAuthorizer(store)

	_, err := authorizer.ResolvePrincipal(context.Background(), ResolvePrincipalInput{})
	if err == nil {
		t.Fatalf("expected unauthenticated error when no override or session cookie is present")
	}
}

func TestAuthorizerResolvePrincipalAcceptsExplicitOverride(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthorizerStore(store)
	authorizer := NewAuthorizer(store)

	principal, err := authorizer.ResolvePrincipal(context.Background(), ResolvePrincipalInput{
		HeaderOrgID:  db.DefaultDevOrganizationID,
		HeaderUserID: db.DefaultDevUserID,
	})
	if err != nil {
		t.Fatalf("ResolvePrincipal returned error: %v", err)
	}
	if got := principal.UserID; got != db.DefaultDevUserID {
		t.Fatalf("expected dev user %q, got %q", db.DefaultDevUserID, got)
	}
}

func TestAuthorizerResolvePrincipalAcceptsSessionCookie(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthorizerStore(store)
	authorizer := NewAuthorizer(store)

	principal, err := authorizer.ResolvePrincipal(context.Background(), ResolvePrincipalInput{
		CookieHeader: authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID),
	})
	if err != nil {
		t.Fatalf("ResolvePrincipal returned error: %v", err)
	}
	if got := principal.OrgID; got != db.DefaultDevOrganizationID {
		t.Fatalf("expected org %q, got %q", db.DefaultDevOrganizationID, got)
	}
}

func TestAuthorizerResolveDevPrincipalUsesBootstrapIdentity(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthorizerStore(store)
	authorizer := NewAuthorizer(store)

	principal, err := authorizer.ResolveDevPrincipal(context.Background())
	if err != nil {
		t.Fatalf("ResolveDevPrincipal returned error: %v", err)
	}
	if got := principal.UserID; got != db.DefaultDevUserID {
		t.Fatalf("expected dev user %q, got %q", db.DefaultDevUserID, got)
	}
}

func TestAuthorizerRequirePermissionRejectsMissingPermission(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthorizerStore(store)
	authorizer := NewAuthorizer(store)

	principal, err := authorizer.ResolvePrincipal(context.Background(), ResolvePrincipalInput{
		HeaderOrgID:  db.DefaultDevOrganizationID,
		HeaderUserID: db.DefaultDevUserID,
	})
	if err != nil {
		t.Fatalf("ResolvePrincipal returned error: %v", err)
	}
	if err := authorizer.RequirePermission(context.Background(), principal, "org.members.write"); err == nil {
		t.Fatalf("expected missing permission error")
	}
}

func seedAuthorizerStore(store *db.MemoryStore) {
	store.Organizations[db.DefaultDevOrganizationID] = org.Organization{
		ID:                   db.DefaultDevOrganizationID,
		Slug:                 "dev-org",
		DisplayName:          "Development Organization",
		DefaultUILocale:      "zh-CN",
		DefaultContentLocale: "zh-CN",
	}
	store.Users[db.DefaultDevUserID] = auth.User{
		ID:                db.DefaultDevUserID,
		Email:             "dev-user@hualala.local",
		DisplayName:       "Development Operator",
		PreferredUILocale: "zh-CN",
	}
	store.Roles[db.DefaultDevRoleID] = org.Role{
		ID:          db.DefaultDevRoleID,
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "admin",
		DisplayName: "Administrator",
	}
	store.Memberships[db.DefaultDevMembershipID] = org.Member{
		ID:     db.DefaultDevMembershipID,
		OrgID:  db.DefaultDevOrganizationID,
		UserID: db.DefaultDevUserID,
		RoleID: db.DefaultDevRoleID,
		Status: "active",
	}
	store.RolePermissions[db.DefaultDevRoleID] = []string{
		"session.read",
	}
}
