package authz

import (
	"context"
	"errors"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Principal struct {
	OrgID        string
	UserID       string
	MembershipID string
	RoleID       string
}

type Authorizer struct {
	repo db.AuthOrgRepository
}

type ResolvePrincipalInput struct {
	HeaderOrgID  string
	HeaderUserID string
	CookieHeader string
}

func NewAuthorizer(repo db.AuthOrgRepository) Authorizer {
	return Authorizer{repo: repo}
}

func (a Authorizer) ResolvePrincipal(_ context.Context, input ResolvePrincipalInput) (Principal, error) {
	if a.repo == nil {
		return Principal{}, errors.New("unauthenticated: repository is required")
	}
	orgID := strings.TrimSpace(input.HeaderOrgID)
	userID := strings.TrimSpace(input.HeaderUserID)
	if (orgID == "") != (userID == "") {
		return Principal{}, errors.New("unauthenticated: explicit override requires both org and user")
	}
	if orgID == "" || userID == "" {
		sessionPrincipal, ok := authsession.ResolvePrincipal(input.CookieHeader)
		if !ok {
			return Principal{}, errors.New("unauthenticated: active session not found")
		}
		if orgID == "" {
			orgID = sessionPrincipal.OrgID
		}
		if userID == "" {
			userID = sessionPrincipal.UserID
		}
	}
	membership, ok := a.repo.FindMembership(orgID, userID)
	if !ok || strings.TrimSpace(membership.Status) != "active" {
		return Principal{}, errors.New("unauthenticated: active membership not found")
	}
	return Principal{
		OrgID:        membership.OrgID,
		UserID:       membership.UserID,
		MembershipID: membership.ID,
		RoleID:       membership.RoleID,
	}, nil
}

func (a Authorizer) ResolveDevPrincipal(ctx context.Context) (Principal, error) {
	return a.ResolvePrincipal(ctx, ResolvePrincipalInput{
		HeaderOrgID:  db.DefaultDevOrganizationID,
		HeaderUserID: db.DefaultDevUserID,
	})
}

func (a Authorizer) ResolveRefreshPrincipal(_ context.Context, cookieHeader string, refreshToken string) (Principal, error) {
	if a.repo == nil {
		return Principal{}, errors.New("unauthenticated: repository is required")
	}
	sessionPrincipal, err := authsession.ResolveRefreshPrincipal(cookieHeader, refreshToken)
	if err != nil {
		return Principal{}, errors.New("unauthenticated: refresh session is unavailable")
	}
	membership, ok := a.repo.FindMembership(sessionPrincipal.OrgID, sessionPrincipal.UserID)
	if !ok || strings.TrimSpace(membership.Status) != "active" {
		return Principal{}, errors.New("unauthenticated: active membership not found")
	}
	return Principal{
		OrgID:        membership.OrgID,
		UserID:       membership.UserID,
		MembershipID: membership.ID,
		RoleID:       membership.RoleID,
	}, nil
}

func (a Authorizer) RequirePermission(_ context.Context, principal Principal, permissionCode string) error {
	if a.repo == nil {
		return errors.New("permission denied: repository is required")
	}
	if strings.TrimSpace(permissionCode) == "" {
		return nil
	}
	if strings.TrimSpace(principal.RoleID) == "" {
		return errors.New("permission denied: role is required")
	}
	for _, granted := range a.repo.ListRolePermissions(principal.RoleID) {
		if strings.TrimSpace(granted) == strings.TrimSpace(permissionCode) {
			return nil
		}
	}
	return errors.New("permission denied: missing " + strings.TrimSpace(permissionCode))
}

func (a Authorizer) EnsureMemberInOrg(member org.Member, orgID string) error {
	if strings.TrimSpace(member.OrgID) != strings.TrimSpace(orgID) {
		return errors.New("permission denied: member does not belong to target org")
	}
	return nil
}

func (a Authorizer) EnsureRoleInOrg(role org.Role, orgID string) error {
	if strings.TrimSpace(role.OrgID) != strings.TrimSpace(orgID) {
		return errors.New("permission denied: role does not belong to target org")
	}
	return nil
}
