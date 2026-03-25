package orgapp

import (
	"sort"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/org"
)

const (
	governancePermissionSessionRead          = "session.read"
	governancePermissionUserPreferencesWrite = "user.preferences.write"
	governancePermissionOrgMembersRead       = "org.members.read"
	governancePermissionOrgRolesRead         = "org.roles.read"
	governancePermissionOrgMembersWrite      = "org.members.write"
	governancePermissionOrgSettingsWrite     = "org.settings.write"
	governancePermissionOrgRolesWrite        = "org.roles.write"
	governancePermissionModelGovernanceRead  = "org.model_governance.read"
	governancePermissionModelGovernanceWrite = "org.model_governance.write"
)

func availablePermissions() []org.AvailablePermission {
	return []org.AvailablePermission{
		{Code: governancePermissionSessionRead, DisplayName: "Read current session", Group: "session"},
		{Code: governancePermissionUserPreferencesWrite, DisplayName: "Update user preferences", Group: "preferences"},
		{Code: governancePermissionOrgMembersRead, DisplayName: "Read organization members", Group: "governance"},
		{Code: governancePermissionOrgRolesRead, DisplayName: "Read organization roles", Group: "governance"},
		{Code: governancePermissionOrgMembersWrite, DisplayName: "Update member roles", Group: "governance"},
		{Code: governancePermissionOrgSettingsWrite, DisplayName: "Update organization locale", Group: "governance"},
		{Code: governancePermissionOrgRolesWrite, DisplayName: "Manage roles and permissions", Group: "governance"},
		{Code: governancePermissionModelGovernanceRead, DisplayName: "Read model governance resources", Group: "governance"},
		{Code: governancePermissionModelGovernanceWrite, DisplayName: "Manage model governance resources", Group: "governance"},
	}
}

func availablePermissionCodes() map[string]struct{} {
	items := make(map[string]struct{}, len(availablePermissions()))
	for _, permission := range availablePermissions() {
		items[permission.Code] = struct{}{}
	}
	return items
}

func normalizePermissionCodes(permissionCodes []string) []string {
	seen := make(map[string]struct{}, len(permissionCodes))
	items := make([]string, 0, len(permissionCodes))
	for _, permissionCode := range permissionCodes {
		code := strings.TrimSpace(permissionCode)
		if code == "" {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		items = append(items, code)
	}
	sort.Strings(items)
	return items
}

func governanceCorePermissionCodes() []string {
	return []string{
		governancePermissionOrgRolesRead,
		governancePermissionOrgRolesWrite,
		governancePermissionOrgMembersRead,
		governancePermissionOrgMembersWrite,
	}
}
