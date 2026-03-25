package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
	"github.com/lib/pq"
)

func (*PostgresStore) GenerateModelProfileID() string   { return uuid.NewString() }
func (*PostgresStore) GeneratePromptTemplateID() string { return uuid.NewString() }
func (*PostgresStore) GenerateContextBundleID() string  { return uuid.NewString() }

func (s *PostgresStore) SaveModelProfile(ctx context.Context, record modelgovernance.ModelProfile) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO model_profiles (
			id, organization_id, provider, model_name, capability_type, region,
			supported_input_locales, supported_output_locales, pricing_snapshot,
			rate_limit_policy, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    provider = EXCLUDED.provider,
		    model_name = EXCLUDED.model_name,
		    capability_type = EXCLUDED.capability_type,
		    region = EXCLUDED.region,
		    supported_input_locales = EXCLUDED.supported_input_locales,
		    supported_output_locales = EXCLUDED.supported_output_locales,
		    pricing_snapshot = EXCLUDED.pricing_snapshot,
		    rate_limit_policy = EXCLUDED.rate_limit_policy,
		    status = EXCLUDED.status,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, nullableUUID(record.OrganizationID), emptyToNil(record.Provider), emptyToNil(record.ModelName), emptyToNil(record.CapabilityType), emptyToNil(record.Region), pq.Array(record.SupportedInputLocales), pq.Array(record.SupportedOutputLocales), defaultJSON(record.PricingSnapshotJSON), defaultJSON(record.RateLimitPolicyJSON), defaultString(record.Status, "active"), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert model profile %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetModelProfile(modelProfileID string) (modelgovernance.ModelProfile, bool) {
	items := s.listModelProfiles(`
		SELECT id::text, organization_id::text, COALESCE(provider, ''), COALESCE(model_name, ''),
		       COALESCE(capability_type, ''), COALESCE(region, ''), COALESCE(supported_input_locales, ARRAY[]::text[]),
		       COALESCE(supported_output_locales, ARRAY[]::text[]), COALESCE(pricing_snapshot::text, '{}'),
		       COALESCE(rate_limit_policy::text, '{}'), status, created_at, updated_at
		FROM model_profiles
		WHERE id = $1
	`, strings.TrimSpace(modelProfileID))
	if len(items) == 0 {
		return modelgovernance.ModelProfile{}, false
	}
	return items[0], true
}

func (s *PostgresStore) ListModelProfiles(orgID string, capabilityType string, status string) []modelgovernance.ModelProfile {
	return s.listModelProfiles(`
		SELECT id::text, organization_id::text, COALESCE(provider, ''), COALESCE(model_name, ''),
		       COALESCE(capability_type, ''), COALESCE(region, ''), COALESCE(supported_input_locales, ARRAY[]::text[]),
		       COALESCE(supported_output_locales, ARRAY[]::text[]), COALESCE(pricing_snapshot::text, '{}'),
		       COALESCE(rate_limit_policy::text, '{}'), status, created_at, updated_at
		FROM model_profiles
		WHERE ($1 = '' OR organization_id::text = $1)
		  AND ($2 = '' OR capability_type = $2)
		  AND ($3 = '' OR status = $3)
		ORDER BY created_at ASC, id ASC
	`, strings.TrimSpace(orgID), strings.TrimSpace(capabilityType), strings.TrimSpace(status))
}

func (s *PostgresStore) listModelProfiles(query string, args ...any) []modelgovernance.ModelProfile {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]modelgovernance.ModelProfile, 0)
	for rows.Next() {
		var (
			record                 modelgovernance.ModelProfile
			supportedInputLocales  pq.StringArray
			supportedOutputLocales pq.StringArray
		)
		if err := rows.Scan(&record.ID, &record.OrganizationID, &record.Provider, &record.ModelName, &record.CapabilityType, &record.Region, &supportedInputLocales, &supportedOutputLocales, &record.PricingSnapshotJSON, &record.RateLimitPolicyJSON, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.SupportedInputLocales = append([]string(nil), supportedInputLocales...)
		record.SupportedOutputLocales = append([]string(nil), supportedOutputLocales...)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SavePromptTemplate(ctx context.Context, record modelgovernance.PromptTemplate) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO prompt_templates (
			id, organization_id, template_family, template_key, locale, version,
			content, input_schema, output_schema, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    template_family = EXCLUDED.template_family,
		    template_key = EXCLUDED.template_key,
		    locale = EXCLUDED.locale,
		    version = EXCLUDED.version,
		    content = EXCLUDED.content,
		    input_schema = EXCLUDED.input_schema,
		    output_schema = EXCLUDED.output_schema,
		    status = EXCLUDED.status,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, nullableUUID(record.OrganizationID), emptyToNil(record.TemplateFamily), emptyToNil(record.TemplateKey), emptyToNil(record.Locale), record.Version, emptyToNil(record.Content), defaultJSON(record.InputSchemaJSON), defaultJSON(record.OutputSchemaJSON), defaultString(record.Status, "draft"), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert prompt template %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetPromptTemplate(promptTemplateID string) (modelgovernance.PromptTemplate, bool) {
	items := s.listPromptTemplates(`
		SELECT id::text, organization_id::text, COALESCE(template_family, ''), COALESCE(template_key, ''),
		       COALESCE(locale, ''), version, COALESCE(content, ''), COALESCE(input_schema::text, '{}'),
		       COALESCE(output_schema::text, '{}'), status, created_at, updated_at
		FROM prompt_templates
		WHERE id = $1
	`, strings.TrimSpace(promptTemplateID))
	if len(items) == 0 {
		return modelgovernance.PromptTemplate{}, false
	}
	return items[0], true
}

func (s *PostgresStore) ListPromptTemplates(orgID string, templateKey string, locale string, status string) []modelgovernance.PromptTemplate {
	return s.listPromptTemplates(`
		SELECT id::text, organization_id::text, COALESCE(template_family, ''), COALESCE(template_key, ''),
		       COALESCE(locale, ''), version, COALESCE(content, ''), COALESCE(input_schema::text, '{}'),
		       COALESCE(output_schema::text, '{}'), status, created_at, updated_at
		FROM prompt_templates
		WHERE ($1 = '' OR organization_id::text = $1)
		  AND ($2 = '' OR template_key = $2)
		  AND ($3 = '' OR locale = $3)
		  AND ($4 = '' OR status = $4)
		ORDER BY template_key ASC, locale ASC, version ASC, id ASC
	`, strings.TrimSpace(orgID), strings.TrimSpace(templateKey), strings.TrimSpace(locale), strings.TrimSpace(status))
}

func (s *PostgresStore) listPromptTemplates(query string, args ...any) []modelgovernance.PromptTemplate {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]modelgovernance.PromptTemplate, 0)
	for rows.Next() {
		var record modelgovernance.PromptTemplate
		if err := rows.Scan(&record.ID, &record.OrganizationID, &record.TemplateFamily, &record.TemplateKey, &record.Locale, &record.Version, &record.Content, &record.InputSchemaJSON, &record.OutputSchemaJSON, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveContextBundle(ctx context.Context, record modelgovernance.ContextBundle) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO context_bundles (
			id, organization_id, project_id, shot_id, shot_execution_id, model_profile_id,
			prompt_template_id, input_locale, output_locale, resolved_prompt_version,
			source_snapshot_ids, referenced_asset_ids, payload, created_by_user_id, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    shot_id = EXCLUDED.shot_id,
		    shot_execution_id = EXCLUDED.shot_execution_id,
		    model_profile_id = EXCLUDED.model_profile_id,
		    prompt_template_id = EXCLUDED.prompt_template_id,
		    input_locale = EXCLUDED.input_locale,
		    output_locale = EXCLUDED.output_locale,
		    resolved_prompt_version = EXCLUDED.resolved_prompt_version,
		    source_snapshot_ids = EXCLUDED.source_snapshot_ids,
		    referenced_asset_ids = EXCLUDED.referenced_asset_ids,
		    payload = EXCLUDED.payload,
		    created_by_user_id = EXCLUDED.created_by_user_id
	`, record.ID, nullableUUID(record.OrganizationID), nullableUUID(record.ProjectID), nullableUUID(record.ShotID), nullableUUID(record.ShotExecutionID), nullableUUID(record.ModelProfileID), nullableUUID(record.PromptTemplateID), emptyToNil(record.InputLocale), emptyToNil(record.OutputLocale), record.ResolvedPromptVersion, pq.Array(record.SourceSnapshotIDs), pq.Array(record.ReferencedAssetIDs), defaultJSON(record.PayloadJSON), nullableUUID(record.CreatedByUserID), record.CreatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert context bundle %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetContextBundle(contextBundleID string) (modelgovernance.ContextBundle, bool) {
	items := s.listContextBundles(`
		SELECT id::text, organization_id::text, COALESCE(project_id::text, ''), COALESCE(shot_id::text, ''),
		       COALESCE(shot_execution_id::text, ''), COALESCE(model_profile_id::text, ''), COALESCE(prompt_template_id::text, ''),
		       COALESCE(input_locale, ''), COALESCE(output_locale, ''), COALESCE(resolved_prompt_version, 0),
		       COALESCE(source_snapshot_ids, ARRAY[]::text[]), COALESCE(referenced_asset_ids, ARRAY[]::text[]),
		       COALESCE(payload::text, '{}'), COALESCE(created_by_user_id::text, ''), created_at
		FROM context_bundles
		WHERE id = $1
	`, strings.TrimSpace(contextBundleID))
	if len(items) == 0 {
		return modelgovernance.ContextBundle{}, false
	}
	return items[0], true
}

func (s *PostgresStore) ListContextBundles(orgID string, projectID string, shotID string, shotExecutionID string, modelProfileID string, promptTemplateID string) []modelgovernance.ContextBundle {
	return s.listContextBundles(`
		SELECT id::text, organization_id::text, COALESCE(project_id::text, ''), COALESCE(shot_id::text, ''),
		       COALESCE(shot_execution_id::text, ''), COALESCE(model_profile_id::text, ''), COALESCE(prompt_template_id::text, ''),
		       COALESCE(input_locale, ''), COALESCE(output_locale, ''), COALESCE(resolved_prompt_version, 0),
		       COALESCE(source_snapshot_ids, ARRAY[]::text[]), COALESCE(referenced_asset_ids, ARRAY[]::text[]),
		       COALESCE(payload::text, '{}'), COALESCE(created_by_user_id::text, ''), created_at
		FROM context_bundles
		WHERE ($1 = '' OR organization_id::text = $1)
		  AND ($2 = '' OR project_id::text = $2)
		  AND ($3 = '' OR shot_id::text = $3)
		  AND ($4 = '' OR shot_execution_id::text = $4)
		  AND ($5 = '' OR model_profile_id::text = $5)
		  AND ($6 = '' OR prompt_template_id::text = $6)
		ORDER BY created_at DESC, id ASC
	`, strings.TrimSpace(orgID), strings.TrimSpace(projectID), strings.TrimSpace(shotID), strings.TrimSpace(shotExecutionID), strings.TrimSpace(modelProfileID), strings.TrimSpace(promptTemplateID))
}

func (s *PostgresStore) listContextBundles(query string, args ...any) []modelgovernance.ContextBundle {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]modelgovernance.ContextBundle, 0)
	for rows.Next() {
		var (
			record             modelgovernance.ContextBundle
			sourceSnapshotIDs  pq.StringArray
			referencedAssetIDs pq.StringArray
		)
		if err := rows.Scan(&record.ID, &record.OrganizationID, &record.ProjectID, &record.ShotID, &record.ShotExecutionID, &record.ModelProfileID, &record.PromptTemplateID, &record.InputLocale, &record.OutputLocale, &record.ResolvedPromptVersion, &sourceSnapshotIDs, &referencedAssetIDs, &record.PayloadJSON, &record.CreatedByUserID, &record.CreatedAt); err != nil {
			return nil
		}
		record.SourceSnapshotIDs = append([]string(nil), sourceSnapshotIDs...)
		record.ReferencedAssetIDs = append([]string(nil), referencedAssetIDs...)
		record.CreatedAt = record.CreatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func defaultJSON(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}"
	}
	return trimmed
}
