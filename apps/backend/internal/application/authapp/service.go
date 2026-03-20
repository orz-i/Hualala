package authapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	repo       db.AuthOrgRepository
	authorizer authz.Authorizer
}

type GetCurrentSessionInput struct {
	HeaderOrgID  string
	HeaderUserID string
}

type RefreshSessionInput struct {
	HeaderOrgID  string
	HeaderUserID string
	RefreshToken string
}

type UpdateUserPreferencesInput struct {
	ActorOrgID    string
	ActorUserID   string
	UserID        string
	DisplayLocale string
	Timezone      string
}

func NewService(repo db.AuthOrgRepository, authorizer authz.Authorizer) *Service {
	return &Service{repo: repo, authorizer: authorizer}
}

func (s *Service) GetCurrentSession(ctx context.Context, input GetCurrentSessionInput) (auth.Session, error) {
	if s == nil || s.repo == nil {
		return auth.Session{}, errors.New("authapp: repository is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, input.HeaderOrgID, input.HeaderUserID)
	if err != nil {
		return auth.Session{}, err
	}
	return s.buildSession(principal)
}

func (s *Service) RefreshSession(ctx context.Context, input RefreshSessionInput) (auth.Session, error) {
	if strings.TrimSpace(input.RefreshToken) == "" {
		return auth.Session{}, errors.New("authapp: refresh_token is required")
	}
	return s.GetCurrentSession(ctx, GetCurrentSessionInput{
		HeaderOrgID:  input.HeaderOrgID,
		HeaderUserID: input.HeaderUserID,
	})
}

func (s *Service) UpdateUserPreferences(ctx context.Context, input UpdateUserPreferencesInput) (auth.UserPreferences, error) {
	if s == nil || s.repo == nil {
		return auth.UserPreferences{}, errors.New("authapp: repository is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID)
	if err != nil {
		return auth.UserPreferences{}, err
	}
	if strings.TrimSpace(input.UserID) == "" {
		return auth.UserPreferences{}, errors.New("authapp: user_id is required")
	}
	if strings.TrimSpace(input.UserID) != principal.UserID {
		return auth.UserPreferences{}, errors.New("permission denied: users can only update their own preferences")
	}
	if err := s.authorizer.RequirePermission(ctx, principal, "user.preferences.write"); err != nil {
		return auth.UserPreferences{}, err
	}
	record, ok := s.repo.GetUser(principal.UserID)
	if !ok {
		return auth.UserPreferences{}, errors.New("authapp: user not found")
	}
	if locale := strings.TrimSpace(input.DisplayLocale); locale != "" {
		record.PreferredUILocale = locale
	}
	record.Timezone = strings.TrimSpace(input.Timezone)
	if err := s.repo.SaveUser(ctx, record); err != nil {
		return auth.UserPreferences{}, err
	}
	return auth.UserPreferences{
		UserID:        record.ID,
		DisplayLocale: record.PreferredUILocale,
		Timezone:      record.Timezone,
	}, nil
}

func (s *Service) buildSession(principal authz.Principal) (auth.Session, error) {
	user, ok := s.repo.GetUser(principal.UserID)
	if !ok {
		return auth.Session{}, errors.New("authapp: user not found")
	}
	orgRecord, ok := s.repo.GetOrganization(principal.OrgID)
	if !ok {
		return auth.Session{}, errors.New("authapp: organization not found")
	}
	locale := strings.TrimSpace(user.PreferredUILocale)
	if locale == "" {
		locale = strings.TrimSpace(orgRecord.DefaultUILocale)
	}
	return auth.Session{
		SessionID: fmt.Sprintf("dev:%s:%s", principal.OrgID, principal.UserID),
		UserID:    principal.UserID,
		OrgID:     principal.OrgID,
		Locale:    locale,
	}, nil
}
