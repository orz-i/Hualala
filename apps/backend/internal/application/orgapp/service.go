package orgapp

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	repo       db.AuthOrgRepository
	authorizer authz.Authorizer
}

type ListMembersInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type ListRolesInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type GetOrgLocaleSettingsInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type ListAvailablePermissionsInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type CreateRoleInput struct {
	ActorOrgID      string
	ActorUserID     string
	CookieHeader    string
	OrgID           string
	Code            string
	DisplayName     string
	PermissionCodes []string
}

type UpdateRoleInput struct {
	ActorOrgID      string
	ActorUserID     string
	CookieHeader    string
	OrgID           string
	RoleID          string
	DisplayName     string
	PermissionCodes []string
}

type DeleteRoleInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
	RoleID       string
}

type UpdateMemberRoleInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
	MemberID     string
	RoleID       string
}

type UpdateOrgLocaleSettingsInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	DefaultLocale    string
	SupportedLocales []string
}

func NewService(repo db.AuthOrgRepository, authorizer authz.Authorizer) *Service {
	return &Service{repo: repo, authorizer: authorizer}
}

func (s *Service) ListMembers(ctx context.Context, input ListMembersInput) ([]org.Member, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgMembersRead)
	if err != nil {
		return nil, err
	}
	return s.repo.ListMembersByOrganization(principal.OrgID), nil
}

func (s *Service) ListRoles(ctx context.Context, input ListRolesInput) ([]org.Role, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesRead)
	if err != nil {
		return nil, err
	}
	return s.listRolesWithPermissions(principal.OrgID), nil
}

func (s *Service) GetOrgLocaleSettings(ctx context.Context, input GetOrgLocaleSettingsInput) (org.OrgLocaleSettings, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesRead)
	if err != nil {
		return org.OrgLocaleSettings{}, err
	}
	record, ok := s.repo.GetOrganization(principal.OrgID)
	if !ok {
		return org.OrgLocaleSettings{}, errors.New("orgapp: organization not found")
	}
	defaultLocale := strings.TrimSpace(record.DefaultUILocale)
	if defaultLocale == "" {
		defaultLocale = "zh-CN"
	}
	return org.OrgLocaleSettings{
		OrgID:            record.ID,
		DefaultLocale:    defaultLocale,
		SupportedLocales: []string{defaultLocale},
	}, nil
}

func (s *Service) ListAvailablePermissions(ctx context.Context, input ListAvailablePermissionsInput) ([]org.AvailablePermission, error) {
	if _, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesRead); err != nil {
		return nil, err
	}
	return availablePermissions(), nil
}

func (s *Service) CreateRole(ctx context.Context, input CreateRoleInput) (org.Role, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesWrite)
	if err != nil {
		return org.Role{}, err
	}
	code := strings.TrimSpace(strings.ToLower(input.Code))
	if code == "" {
		return org.Role{}, errors.New("orgapp: role code is required")
	}
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		return org.Role{}, errors.New("orgapp: display_name is required")
	}
	for _, existing := range s.repo.ListRolesByOrganization(principal.OrgID) {
		if strings.EqualFold(strings.TrimSpace(existing.Code), code) {
			return org.Role{}, errors.New("orgapp: role code already exists")
		}
	}
	permissionCodes, err := s.validatePermissionCodes(input.PermissionCodes)
	if err != nil {
		return org.Role{}, err
	}
	record := org.Role{
		ID:              uuid.NewString(),
		OrgID:           principal.OrgID,
		Code:            code,
		DisplayName:     displayName,
		PermissionCodes: permissionCodes,
	}
	if err := s.repo.SaveRole(ctx, record); err != nil {
		return org.Role{}, err
	}
	if err := s.repo.ReplaceRolePermissions(ctx, record.ID, permissionCodes); err != nil {
		return org.Role{}, err
	}
	return s.getRoleWithPermissions(record.ID)
}

func (s *Service) UpdateRole(ctx context.Context, input UpdateRoleInput) (org.Role, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesWrite)
	if err != nil {
		return org.Role{}, err
	}
	record, ok := s.repo.GetRole(strings.TrimSpace(input.RoleID))
	if !ok {
		return org.Role{}, errors.New("orgapp: role not found")
	}
	if err := s.authorizer.EnsureRoleInOrg(record, principal.OrgID); err != nil {
		return org.Role{}, err
	}
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		return org.Role{}, errors.New("orgapp: display_name is required")
	}
	permissionCodes, err := s.validatePermissionCodes(input.PermissionCodes)
	if err != nil {
		return org.Role{}, err
	}
	if err := s.ensureGovernanceRoleCoverage(principal.OrgID, record.ID, permissionCodes, false); err != nil {
		return org.Role{}, err
	}
	record.DisplayName = displayName
	record.PermissionCodes = permissionCodes
	if err := s.repo.SaveRole(ctx, record); err != nil {
		return org.Role{}, err
	}
	if err := s.repo.ReplaceRolePermissions(ctx, record.ID, permissionCodes); err != nil {
		return org.Role{}, err
	}
	return s.getRoleWithPermissions(record.ID)
}

func (s *Service) DeleteRole(ctx context.Context, input DeleteRoleInput) error {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgRolesWrite)
	if err != nil {
		return err
	}
	roleID := strings.TrimSpace(input.RoleID)
	record, ok := s.repo.GetRole(roleID)
	if !ok {
		return errors.New("orgapp: role not found")
	}
	if err := s.authorizer.EnsureRoleInOrg(record, principal.OrgID); err != nil {
		return err
	}
	for _, member := range s.repo.ListMembersByOrganization(principal.OrgID) {
		if strings.TrimSpace(member.RoleID) == roleID {
			return errors.New("orgapp: role is still assigned to members")
		}
	}
	if err := s.ensureGovernanceRoleCoverage(principal.OrgID, roleID, nil, true); err != nil {
		return err
	}
	return s.repo.DeleteRole(ctx, roleID)
}

func (s *Service) UpdateMemberRole(ctx context.Context, input UpdateMemberRoleInput) (org.Member, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgMembersWrite)
	if err != nil {
		return org.Member{}, err
	}
	member, ok := s.repo.GetMembership(strings.TrimSpace(input.MemberID))
	if !ok {
		return org.Member{}, errors.New("orgapp: member not found")
	}
	if err := s.authorizer.EnsureMemberInOrg(member, principal.OrgID); err != nil {
		return org.Member{}, err
	}
	role, ok := s.repo.GetRole(strings.TrimSpace(input.RoleID))
	if !ok {
		return org.Member{}, errors.New("orgapp: role not found")
	}
	if err := s.authorizer.EnsureRoleInOrg(role, principal.OrgID); err != nil {
		return org.Member{}, err
	}
	if err := s.ensureGovernanceCoverageAfterMemberRoleUpdate(principal.OrgID, member.ID, role.ID); err != nil {
		return org.Member{}, err
	}
	member.RoleID = role.ID
	if err := s.repo.SaveMembership(ctx, member); err != nil {
		return org.Member{}, err
	}
	return member, nil
}

func (s *Service) UpdateOrgLocaleSettings(ctx context.Context, input UpdateOrgLocaleSettingsInput) (org.OrgLocaleSettings, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionOrgSettingsWrite)
	if err != nil {
		return org.OrgLocaleSettings{}, err
	}
	defaultLocale := strings.TrimSpace(input.DefaultLocale)
	if defaultLocale == "" {
		return org.OrgLocaleSettings{}, errors.New("orgapp: default_locale is required")
	}
	record, ok := s.repo.GetOrganization(principal.OrgID)
	if !ok {
		return org.OrgLocaleSettings{}, errors.New("orgapp: organization not found")
	}
	record.DefaultUILocale = defaultLocale
	record.DefaultContentLocale = defaultLocale
	if err := s.repo.SaveOrganization(ctx, record); err != nil {
		return org.OrgLocaleSettings{}, err
	}
	return org.OrgLocaleSettings{
		OrgID:            record.ID,
		DefaultLocale:    defaultLocale,
		SupportedLocales: []string{defaultLocale},
	}, nil
}

func (s *Service) listRolesWithPermissions(orgID string) []org.Role {
	roles := s.repo.ListRolesByOrganization(orgID)
	for index := range roles {
		roles[index].PermissionCodes = s.repo.ListRolePermissions(roles[index].ID)
	}
	return roles
}

func (s *Service) getRoleWithPermissions(roleID string) (org.Role, error) {
	record, ok := s.repo.GetRole(strings.TrimSpace(roleID))
	if !ok {
		return org.Role{}, errors.New("orgapp: role not found")
	}
	record.PermissionCodes = s.repo.ListRolePermissions(record.ID)
	return record, nil
}

func (s *Service) validatePermissionCodes(permissionCodes []string) ([]string, error) {
	allowed := availablePermissionCodes()
	normalized := normalizePermissionCodes(permissionCodes)
	for _, permissionCode := range normalized {
		if _, ok := allowed[permissionCode]; !ok {
			return nil, errors.New("orgapp: unsupported permission code " + permissionCode)
		}
	}
	return normalized, nil
}

func (s *Service) ensureGovernanceRoleCoverage(orgID string, targetRoleID string, targetPermissionCodes []string, deleting bool) error {
	rolePermissions := make(map[string][]string)
	for _, role := range s.repo.ListRolesByOrganization(orgID) {
		if deleting && role.ID == targetRoleID {
			continue
		}
		if role.ID == targetRoleID && targetPermissionCodes != nil {
			rolePermissions[role.ID] = append([]string(nil), targetPermissionCodes...)
			continue
		}
		rolePermissions[role.ID] = s.repo.ListRolePermissions(role.ID)
	}
	for _, member := range s.repo.ListMembersByOrganization(orgID) {
		if strings.TrimSpace(member.Status) != "active" {
			continue
		}
		roleID := strings.TrimSpace(member.RoleID)
		if roleID == "" {
			continue
		}
		if hasAllPermissionCodes(rolePermissions[roleID], governanceCorePermissionCodes()) {
			return nil
		}
	}
	return errors.New("orgapp: role change would remove the last active governance role")
}

func (s *Service) ensureGovernanceCoverageAfterMemberRoleUpdate(orgID string, targetMemberID string, targetRoleID string) error {
	rolePermissions := make(map[string][]string)
	for _, role := range s.repo.ListRolesByOrganization(orgID) {
		rolePermissions[role.ID] = s.repo.ListRolePermissions(role.ID)
	}
	for _, member := range s.repo.ListMembersByOrganization(orgID) {
		if strings.TrimSpace(member.Status) != "active" {
			continue
		}
		effectiveRoleID := strings.TrimSpace(member.RoleID)
		if member.ID == targetMemberID {
			effectiveRoleID = strings.TrimSpace(targetRoleID)
		}
		if effectiveRoleID == "" {
			continue
		}
		if hasAllPermissionCodes(rolePermissions[effectiveRoleID], governanceCorePermissionCodes()) {
			return nil
		}
	}
	return errors.New("orgapp: member role change would remove the last active governance role")
}

func hasAllPermissionCodes(granted []string, required []string) bool {
	if len(required) == 0 {
		return true
	}
	grantedSet := make(map[string]struct{}, len(granted))
	for _, permissionCode := range granted {
		grantedSet[strings.TrimSpace(permissionCode)] = struct{}{}
	}
	for _, permissionCode := range required {
		if _, ok := grantedSet[strings.TrimSpace(permissionCode)]; !ok {
			return false
		}
	}
	return true
}

func (s *Service) resolveOrgPrincipal(ctx context.Context, actorOrgID string, actorUserID string, cookieHeader string, targetOrgID string, permissionCode string) (authz.Principal, error) {
	if s == nil || s.repo == nil {
		return authz.Principal{}, errors.New("orgapp: repository is required")
	}
	target := strings.TrimSpace(targetOrgID)
	if target == "" {
		return authz.Principal{}, errors.New("orgapp: org_id is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, authz.ResolvePrincipalInput{
		HeaderOrgID:  actorOrgID,
		HeaderUserID: actorUserID,
		CookieHeader: cookieHeader,
	})
	if err != nil {
		return authz.Principal{}, err
	}
	if principal.OrgID != target {
		return authz.Principal{}, errors.New("permission denied: principal does not belong to target org")
	}
	if err := s.authorizer.RequirePermission(ctx, principal, permissionCode); err != nil {
		return authz.Principal{}, err
	}
	return principal, nil
}
