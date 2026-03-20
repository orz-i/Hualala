package orgapp

import (
	"context"
	"errors"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	repo       db.AuthOrgRepository
	authorizer authz.Authorizer
}

type ListMembersInput struct {
	ActorOrgID  string
	ActorUserID string
	OrgID       string
}

type ListRolesInput struct {
	ActorOrgID  string
	ActorUserID string
	OrgID       string
}

type UpdateMemberRoleInput struct {
	ActorOrgID  string
	ActorUserID string
	OrgID       string
	MemberID    string
	RoleID      string
}

type UpdateOrgLocaleSettingsInput struct {
	ActorOrgID       string
	ActorUserID      string
	OrgID            string
	DefaultLocale    string
	SupportedLocales []string
}

func NewService(repo db.AuthOrgRepository, authorizer authz.Authorizer) *Service {
	return &Service{repo: repo, authorizer: authorizer}
}

func (s *Service) ListMembers(ctx context.Context, input ListMembersInput) ([]org.Member, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.OrgID, "org.members.read")
	if err != nil {
		return nil, err
	}
	return s.repo.ListMembersByOrganization(principal.OrgID), nil
}

func (s *Service) ListRoles(ctx context.Context, input ListRolesInput) ([]org.Role, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.OrgID, "org.roles.read")
	if err != nil {
		return nil, err
	}
	return s.repo.ListRolesByOrganization(principal.OrgID), nil
}

func (s *Service) UpdateMemberRole(ctx context.Context, input UpdateMemberRoleInput) (org.Member, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.OrgID, "org.members.write")
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
	member.RoleID = role.ID
	if err := s.repo.SaveMembership(ctx, member); err != nil {
		return org.Member{}, err
	}
	return member, nil
}

func (s *Service) UpdateOrgLocaleSettings(ctx context.Context, input UpdateOrgLocaleSettingsInput) (org.OrgLocaleSettings, error) {
	principal, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.OrgID, "org.settings.write")
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

func (s *Service) resolveOrgPrincipal(ctx context.Context, actorOrgID string, actorUserID string, targetOrgID string, permissionCode string) (authz.Principal, error) {
	if s == nil || s.repo == nil {
		return authz.Principal{}, errors.New("orgapp: repository is required")
	}
	target := strings.TrimSpace(targetOrgID)
	if target == "" {
		return authz.Principal{}, errors.New("orgapp: org_id is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, actorOrgID, actorUserID)
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
