package authapp

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestGetCurrentSessionRequiresOverrideOrSession(t *testing.T) {
	store := db.NewMemoryStore()
	seedDevAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	session, err := service.GetCurrentSession(context.Background(), GetCurrentSessionInput{})
	if err == nil {
		t.Fatalf("expected unauthenticated error, got session %#v", session)
	}
}

func TestGetCurrentSessionAcceptsSessionCookie(t *testing.T) {
	store := db.NewMemoryStore()
	seedDevAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	session, err := service.GetCurrentSession(context.Background(), GetCurrentSessionInput{
		CookieHeader: authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID),
	})
	if err != nil {
		t.Fatalf("GetCurrentSession returned error: %v", err)
	}
	if got := session.UserID; got != db.DefaultDevUserID {
		t.Fatalf("expected dev user %q, got %q", db.DefaultDevUserID, got)
	}
}

func TestStartDevSessionReturnsBootstrapIdentity(t *testing.T) {
	store := db.NewMemoryStore()
	seedDevAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	session, err := service.StartDevSession(context.Background())
	if err != nil {
		t.Fatalf("StartDevSession returned error: %v", err)
	}
	if got := session.SessionID; got != "dev:"+db.DefaultDevOrganizationID+":"+db.DefaultDevUserID {
		t.Fatalf("unexpected session id %q", got)
	}
}

func TestUpdateUserPreferencesOnlyAllowsSelfUpdate(t *testing.T) {
	store := db.NewMemoryStore()
	seedDevAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	_, err := service.UpdateUserPreferences(context.Background(), UpdateUserPreferencesInput{
		ActorOrgID:    db.DefaultDevOrganizationID,
		ActorUserID:   db.DefaultDevUserID,
		UserID:        "99999999-9999-9999-9999-999999999999",
		DisplayLocale: "en-US",
		Timezone:      "America/Los_Angeles",
	})
	if err == nil {
		t.Fatalf("expected self-update restriction error")
	}
}

func TestRefreshSessionRequiresRefreshTokenAndCookie(t *testing.T) {
	store := db.NewMemoryStore()
	seedDevAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	if _, err := service.RefreshSession(context.Background(), RefreshSessionInput{}); err == nil {
		t.Fatalf("expected refresh_token is required error")
	}

	session, err := service.RefreshSession(context.Background(), RefreshSessionInput{
		CookieHeader:  authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID),
		RefreshToken:  authsession.DevRefreshToken,
	})
	if err != nil {
		t.Fatalf("RefreshSession returned error: %v", err)
	}
	if got := session.UserID; got != db.DefaultDevUserID {
		t.Fatalf("expected user %q, got %q", db.DefaultDevUserID, got)
	}
}

func seedDevAuthOrgStore(store *db.MemoryStore) {
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
		"user.preferences.write",
		"org.members.read",
		"org.roles.read",
		"org.members.write",
		"org.settings.write",
	}
}
