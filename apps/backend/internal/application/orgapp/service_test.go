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

func TestGetOrgLocaleSettingsAndAvailablePermissions(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	settings, err := service.GetOrgLocaleSettings(context.Background(), GetOrgLocaleSettingsInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("GetOrgLocaleSettings returned error: %v", err)
	}
	if got := settings.DefaultLocale; got != "zh-CN" {
		t.Fatalf("expected zh-CN locale, got %q", got)
	}

	permissions, err := service.ListAvailablePermissions(context.Background(), ListAvailablePermissionsInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("ListAvailablePermissions returned error: %v", err)
	}
	found := false
	for _, permission := range permissions {
		if permission.Code == "org.roles.write" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected org.roles.write in permission catalog")
	}
}

func TestCreateUpdateAndDeleteRole(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	role, err := service.CreateRole(context.Background(), CreateRoleInput{
		ActorOrgID:      db.DefaultDevOrganizationID,
		ActorUserID:     db.DefaultDevUserID,
		OrgID:           db.DefaultDevOrganizationID,
		Code:            "viewer",
		DisplayName:     "Viewer",
		PermissionCodes: []string{"session.read", "user.preferences.write"},
	})
	if err != nil {
		t.Fatalf("CreateRole returned error: %v", err)
	}
	if role.Code != "viewer" {
		t.Fatalf("expected role code viewer, got %q", role.Code)
	}

	updatedRole, err := service.UpdateRole(context.Background(), UpdateRoleInput{
		ActorOrgID:      db.DefaultDevOrganizationID,
		ActorUserID:     db.DefaultDevUserID,
		OrgID:           db.DefaultDevOrganizationID,
		RoleID:          role.ID,
		DisplayName:     "Read Only",
		PermissionCodes: []string{"session.read"},
	})
	if err != nil {
		t.Fatalf("UpdateRole returned error: %v", err)
	}
	if updatedRole.DisplayName != "Read Only" {
		t.Fatalf("expected updated display name, got %q", updatedRole.DisplayName)
	}

	if err := service.DeleteRole(context.Background(), DeleteRoleInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		RoleID:      role.ID,
	}); err != nil {
		t.Fatalf("DeleteRole returned error: %v", err)
	}
	if _, ok := store.GetRole(role.ID); ok {
		t.Fatalf("expected deleted role %q to be removed", role.ID)
	}
}

func TestDeleteRoleRejectsInUseRoleAndLockoutChanges(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	if err := service.DeleteRole(context.Background(), DeleteRoleInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		RoleID:      db.DefaultDevRoleID,
	}); err == nil {
		t.Fatalf("expected in-use role deletion to fail")
	}

	if _, err := service.UpdateRole(context.Background(), UpdateRoleInput{
		ActorOrgID:      db.DefaultDevOrganizationID,
		ActorUserID:     db.DefaultDevUserID,
		OrgID:           db.DefaultDevOrganizationID,
		RoleID:          db.DefaultDevRoleID,
		DisplayName:     "Administrator",
		PermissionCodes: []string{"session.read"},
	}); err == nil {
		t.Fatalf("expected governance lockout protection to reject permission downgrade")
	}
}

func TestUpdateMemberRoleRejectsGovernanceLockout(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgStore(store)
	service := NewService(store, authz.NewAuthorizer(store))

	viewerRoleID := "77777777-7777-7777-7777-777777777777"
	store.Roles[viewerRoleID] = org.Role{
		ID:          viewerRoleID,
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "viewer",
		DisplayName: "Viewer",
	}
	store.RolePermissions[viewerRoleID] = []string{
		"session.read",
		"user.preferences.write",
	}

	if _, err := service.UpdateMemberRole(context.Background(), UpdateMemberRoleInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		MemberID:    db.DefaultDevMembershipID,
		RoleID:      viewerRoleID,
	}); err == nil {
		t.Fatalf("expected governance lockout protection to reject role reassignment")
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
		Timezone:          "Asia/Shanghai",
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
		"session.read",
		"user.preferences.write",
		"org.roles.write",
	}
}
