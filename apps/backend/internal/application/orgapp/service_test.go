package orgapp

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestListMembersAndRoles(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	members, err := service.ListMembers(context.Background(), ListMembersInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("ListMembers returned error: %v", err)
	}
	if len(members) != 1 {
		t.Fatalf("expected 1 member, got %d", len(members))
	}

	roles, err := service.ListRoles(context.Background(), ListRolesInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("ListRoles returned error: %v", err)
	}
	if len(roles) != 2 {
		t.Fatalf("expected 2 roles, got %d", len(roles))
	}
}

func TestUpdateOrgLocaleSettingsPersistsDefaultLocale(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	settings, err := service.UpdateOrgLocaleSettings(context.Background(), UpdateOrgLocaleSettingsInput{
		ActorOrgID:       db.DefaultDevOrganizationID,
		ActorUserID:      db.DefaultDevUserID,
		OrgID:            db.DefaultDevOrganizationID,
		DefaultLocale:    "en-US",
		SupportedLocales: []string{"en-US", "zh-CN"},
	})
	if err != nil {
		t.Fatalf("UpdateOrgLocaleSettings returned error: %v", err)
	}
	if got := settings.DefaultLocale; got != "en-US" {
		t.Fatalf("expected en-US locale, got %q", got)
	}
	if got := settings.SupportedLocales; len(got) != 1 || got[0] != "en-US" {
		t.Fatalf("expected supported locales [en-US], got %v", got)
	}
}

func seedAuthOrgStore(store *db.MemoryStore) {
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
	store.Roles["55555555-5555-5555-5555-555555555555"] = org.Role{
		ID:          "55555555-5555-5555-5555-555555555555",
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "editor",
		DisplayName: "Editor",
	}
	store.Memberships[db.DefaultDevMembershipID] = org.Member{
		ID:     db.DefaultDevMembershipID,
		OrgID:  db.DefaultDevOrganizationID,
		UserID: db.DefaultDevUserID,
		RoleID: db.DefaultDevRoleID,
		Status: "active",
	}
	store.RolePermissions[db.DefaultDevRoleID] = []string{
		"org.members.read",
		"org.roles.read",
		"org.members.write",
		"org.settings.write",
	}
}
