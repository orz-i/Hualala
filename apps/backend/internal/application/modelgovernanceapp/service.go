package modelgovernanceapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	repo       db.ModelGovernanceRepository
	authorizer authz.Authorizer
}

type ListModelProfilesInput struct {
	ActorOrgID     string
	ActorUserID    string
	CookieHeader   string
	OrgID          string
	CapabilityType string
	Status         string
}

type CreateModelProfileInput struct {
	ActorOrgID             string
	ActorUserID            string
	CookieHeader           string
	OrgID                  string
	Provider               string
	ModelName              string
	CapabilityType         string
	Region                 string
	SupportedInputLocales  []string
	SupportedOutputLocales []string
	PricingSnapshotJSON    string
	RateLimitPolicyJSON    string
}

type UpdateModelProfileInput struct {
	ActorOrgID             string
	ActorUserID            string
	CookieHeader           string
	OrgID                  string
	ModelProfileID         string
	SupportedInputLocales  []string
	SupportedOutputLocales []string
	PricingSnapshotJSON    string
	RateLimitPolicyJSON    string
}

type SetModelProfileStatusInput struct {
	ActorOrgID     string
	ActorUserID    string
	CookieHeader   string
	OrgID          string
	ModelProfileID string
	Status         string
}

type ListPromptTemplatesInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
	TemplateKey  string
	Locale       string
	Status       string
}

type GetPromptTemplateInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	PromptTemplateID string
}

type CreatePromptTemplateVersionInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	TemplateFamily   string
	TemplateKey      string
	Locale           string
	Content          string
	InputSchemaJSON  string
	OutputSchemaJSON string
}

type UpdatePromptTemplateDraftInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	PromptTemplateID string
	Content          string
	InputSchemaJSON  string
	OutputSchemaJSON string
}

type SetPromptTemplateStatusInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	PromptTemplateID string
	Status           string
}

type ListContextBundlesInput struct {
	ActorOrgID       string
	ActorUserID      string
	CookieHeader     string
	OrgID            string
	ProjectID        string
	ShotID           string
	ShotExecutionID  string
	ModelProfileID   string
	PromptTemplateID string
}

type GetContextBundleInput struct {
	ActorOrgID      string
	ActorUserID     string
	CookieHeader    string
	OrgID           string
	ContextBundleID string
}

func NewService(repo db.ModelGovernanceRepository, authorizer authz.Authorizer) *Service {
	return &Service{repo: repo, authorizer: authorizer}
}

func (s *Service) ListModelProfiles(ctx context.Context, input ListModelProfilesInput) ([]modelgovernance.ModelProfile, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceRead)
	if err != nil {
		return nil, err
	}
	return s.repo.ListModelProfiles(orgID, input.CapabilityType, input.Status), nil
}

func (s *Service) CreateModelProfile(ctx context.Context, input CreateModelProfileInput) (modelgovernance.ModelProfile, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	record := modelgovernance.ModelProfile{
		ID:                     s.repo.GenerateModelProfileID(),
		OrganizationID:         orgID,
		Provider:               strings.TrimSpace(input.Provider),
		ModelName:              strings.TrimSpace(input.ModelName),
		CapabilityType:         strings.TrimSpace(input.CapabilityType),
		Region:                 strings.TrimSpace(input.Region),
		SupportedInputLocales:  normalizeStrings(input.SupportedInputLocales),
		SupportedOutputLocales: normalizeStrings(input.SupportedOutputLocales),
		PricingSnapshotJSON:    strings.TrimSpace(input.PricingSnapshotJSON),
		RateLimitPolicyJSON:    strings.TrimSpace(input.RateLimitPolicyJSON),
		Status:                 modelProfileStatusActive,
		CreatedAt:              time.Now().UTC(),
		UpdatedAt:              time.Now().UTC(),
	}
	if err := validateModelProfile(record, true); err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	if err := s.repo.SaveModelProfile(ctx, record); err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	saved, _ := s.repo.GetModelProfile(record.ID)
	return saved, nil
}

func (s *Service) UpdateModelProfile(ctx context.Context, input UpdateModelProfileInput) (modelgovernance.ModelProfile, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	record, err := s.requireModelProfile(orgID, input.ModelProfileID)
	if err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	record.SupportedInputLocales = normalizeStrings(input.SupportedInputLocales)
	record.SupportedOutputLocales = normalizeStrings(input.SupportedOutputLocales)
	record.PricingSnapshotJSON = strings.TrimSpace(input.PricingSnapshotJSON)
	record.RateLimitPolicyJSON = strings.TrimSpace(input.RateLimitPolicyJSON)
	record.UpdatedAt = time.Now().UTC()
	if err := validateModelProfile(record, false); err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	if err := s.repo.SaveModelProfile(ctx, record); err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	saved, _ := s.repo.GetModelProfile(record.ID)
	return saved, nil
}

func (s *Service) SetModelProfileStatus(ctx context.Context, input SetModelProfileStatusInput) (modelgovernance.ModelProfile, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	record, err := s.requireModelProfile(orgID, input.ModelProfileID)
	if err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	status := strings.TrimSpace(input.Status)
	if !isAllowedModelProfileStatus(status) {
		return modelgovernance.ModelProfile{}, errors.New("modelgovernanceapp: invalid argument status")
	}
	record.Status = status
	record.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveModelProfile(ctx, record); err != nil {
		return modelgovernance.ModelProfile{}, err
	}
	saved, _ := s.repo.GetModelProfile(record.ID)
	return saved, nil
}

func (s *Service) ListPromptTemplates(ctx context.Context, input ListPromptTemplatesInput) ([]modelgovernance.PromptTemplate, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceRead)
	if err != nil {
		return nil, err
	}
	return s.repo.ListPromptTemplates(orgID, input.TemplateKey, input.Locale, input.Status), nil
}

func (s *Service) GetPromptTemplate(ctx context.Context, input GetPromptTemplateInput) (modelgovernance.PromptTemplate, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceRead)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	return s.requirePromptTemplate(orgID, input.PromptTemplateID)
}

func (s *Service) CreatePromptTemplateVersion(ctx context.Context, input CreatePromptTemplateVersionInput) (modelgovernance.PromptTemplate, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	templateKey := strings.TrimSpace(input.TemplateKey)
	locale := strings.TrimSpace(input.Locale)
	existing := s.repo.ListPromptTemplates(orgID, templateKey, locale, "")
	nextVersion := 1
	for _, record := range existing {
		if record.Version >= nextVersion {
			nextVersion = record.Version + 1
		}
	}
	now := time.Now().UTC()
	record := modelgovernance.PromptTemplate{
		ID:               s.repo.GeneratePromptTemplateID(),
		OrganizationID:   orgID,
		TemplateFamily:   strings.TrimSpace(input.TemplateFamily),
		TemplateKey:      templateKey,
		Locale:           locale,
		Version:          nextVersion,
		Content:          strings.TrimSpace(input.Content),
		InputSchemaJSON:  strings.TrimSpace(input.InputSchemaJSON),
		OutputSchemaJSON: strings.TrimSpace(input.OutputSchemaJSON),
		Status:           promptTemplateStatusDraft,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := validatePromptTemplate(record); err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	if err := s.repo.SavePromptTemplate(ctx, record); err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	saved, _ := s.repo.GetPromptTemplate(record.ID)
	return saved, nil
}

func (s *Service) UpdatePromptTemplateDraft(ctx context.Context, input UpdatePromptTemplateDraftInput) (modelgovernance.PromptTemplate, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	record, err := s.requirePromptTemplate(orgID, input.PromptTemplateID)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	if record.Status != promptTemplateStatusDraft {
		return modelgovernance.PromptTemplate{}, errors.New("failed precondition: only draft prompt template can be updated")
	}
	record.Content = strings.TrimSpace(input.Content)
	record.InputSchemaJSON = strings.TrimSpace(input.InputSchemaJSON)
	record.OutputSchemaJSON = strings.TrimSpace(input.OutputSchemaJSON)
	record.UpdatedAt = time.Now().UTC()
	if err := validatePromptTemplate(record); err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	if err := s.repo.SavePromptTemplate(ctx, record); err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	saved, _ := s.repo.GetPromptTemplate(record.ID)
	return saved, nil
}

func (s *Service) SetPromptTemplateStatus(ctx context.Context, input SetPromptTemplateStatusInput) (modelgovernance.PromptTemplate, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceWrite)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	record, err := s.requirePromptTemplate(orgID, input.PromptTemplateID)
	if err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	status := strings.TrimSpace(input.Status)
	if !isAllowedPromptTemplateStatus(status) {
		return modelgovernance.PromptTemplate{}, errors.New("modelgovernanceapp: invalid argument status")
	}
	if status == promptTemplateStatusActive {
		for _, existing := range s.repo.ListPromptTemplates(orgID, record.TemplateKey, record.Locale, promptTemplateStatusActive) {
			if existing.ID == record.ID {
				continue
			}
			existing.Status = promptTemplateStatusArchived
			existing.UpdatedAt = time.Now().UTC()
			if err := s.repo.SavePromptTemplate(ctx, existing); err != nil {
				return modelgovernance.PromptTemplate{}, err
			}
		}
	}
	record.Status = status
	record.UpdatedAt = time.Now().UTC()
	if err := s.repo.SavePromptTemplate(ctx, record); err != nil {
		return modelgovernance.PromptTemplate{}, err
	}
	saved, _ := s.repo.GetPromptTemplate(record.ID)
	return saved, nil
}

func (s *Service) ListContextBundles(ctx context.Context, input ListContextBundlesInput) ([]modelgovernance.ContextBundle, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceRead)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.ProjectID) == "" {
		return nil, errors.New("modelgovernanceapp: project_id is required")
	}
	return s.repo.ListContextBundles(orgID, input.ProjectID, input.ShotID, input.ShotExecutionID, input.ModelProfileID, input.PromptTemplateID), nil
}

func (s *Service) GetContextBundle(ctx context.Context, input GetContextBundleInput) (modelgovernance.ContextBundle, error) {
	orgID, err := s.resolveOrgPrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID, governancePermissionModelGovernanceRead)
	if err != nil {
		return modelgovernance.ContextBundle{}, err
	}
	record, ok := s.repo.GetContextBundle(strings.TrimSpace(input.ContextBundleID))
	if !ok {
		return modelgovernance.ContextBundle{}, errors.New("modelgovernanceapp: context bundle not found")
	}
	if strings.TrimSpace(record.OrganizationID) != orgID {
		return modelgovernance.ContextBundle{}, errors.New("permission denied: context bundle does not belong to target org")
	}
	return record, nil
}

func (s *Service) resolveOrgPrincipal(ctx context.Context, actorOrgID string, actorUserID string, cookieHeader string, targetOrgID string, permissionCode string) (string, error) {
	if s == nil || s.repo == nil {
		return "", errors.New("modelgovernanceapp: repository is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, authz.ResolvePrincipalInput{
		HeaderOrgID:  actorOrgID,
		HeaderUserID: actorUserID,
		CookieHeader: cookieHeader,
	})
	if err != nil {
		return "", err
	}
	orgID := strings.TrimSpace(targetOrgID)
	if orgID == "" {
		orgID = principal.OrgID
	}
	if principal.OrgID != orgID {
		return "", errors.New("permission denied: principal does not belong to target org")
	}
	if err := s.authorizer.RequirePermission(ctx, principal, permissionCode); err != nil {
		return "", err
	}
	return orgID, nil
}

func (s *Service) requireModelProfile(orgID string, modelProfileID string) (modelgovernance.ModelProfile, error) {
	record, ok := s.repo.GetModelProfile(strings.TrimSpace(modelProfileID))
	if !ok {
		return modelgovernance.ModelProfile{}, errors.New("modelgovernanceapp: model profile not found")
	}
	if strings.TrimSpace(record.OrganizationID) != strings.TrimSpace(orgID) {
		return modelgovernance.ModelProfile{}, errors.New("permission denied: model profile does not belong to target org")
	}
	return record, nil
}

func (s *Service) requirePromptTemplate(orgID string, promptTemplateID string) (modelgovernance.PromptTemplate, error) {
	record, ok := s.repo.GetPromptTemplate(strings.TrimSpace(promptTemplateID))
	if !ok {
		return modelgovernance.PromptTemplate{}, errors.New("modelgovernanceapp: prompt template not found")
	}
	if strings.TrimSpace(record.OrganizationID) != strings.TrimSpace(orgID) {
		return modelgovernance.PromptTemplate{}, errors.New("permission denied: prompt template does not belong to target org")
	}
	return record, nil
}

func validateModelProfile(record modelgovernance.ModelProfile, requireIdentity bool) error {
	if requireIdentity {
		if strings.TrimSpace(record.Provider) == "" {
			return errors.New("modelgovernanceapp: provider is required")
		}
		if strings.TrimSpace(record.ModelName) == "" {
			return errors.New("modelgovernanceapp: model_name is required")
		}
		if strings.TrimSpace(record.CapabilityType) == "" {
			return errors.New("modelgovernanceapp: capability_type is required")
		}
	}
	if len(record.SupportedInputLocales) == 0 {
		return errors.New("modelgovernanceapp: supported_input_locales is required")
	}
	if len(record.SupportedOutputLocales) == 0 {
		return errors.New("modelgovernanceapp: supported_output_locales is required")
	}
	return nil
}

func validatePromptTemplate(record modelgovernance.PromptTemplate) error {
	if strings.TrimSpace(record.TemplateFamily) == "" {
		return errors.New("modelgovernanceapp: template_family is required")
	}
	if strings.TrimSpace(record.TemplateKey) == "" {
		return errors.New("modelgovernanceapp: template_key is required")
	}
	if strings.TrimSpace(record.Locale) == "" {
		return errors.New("modelgovernanceapp: locale is required")
	}
	if strings.TrimSpace(record.Content) == "" {
		return errors.New("modelgovernanceapp: content is required")
	}
	if record.Version <= 0 {
		return errors.New("modelgovernanceapp: version must be greater than 0")
	}
	return nil
}

func normalizeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	items := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		items = append(items, trimmed)
	}
	return items
}

func isAllowedModelProfileStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case modelProfileStatusActive, modelProfileStatusPaused, modelProfileStatusArchived:
		return true
	default:
		return false
	}
}

func isAllowedPromptTemplateStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case promptTemplateStatusDraft, promptTemplateStatusActive, promptTemplateStatusArchived:
		return true
	default:
		return false
	}
}
