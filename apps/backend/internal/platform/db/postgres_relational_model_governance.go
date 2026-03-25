package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
	"github.com/lib/pq"
)

func (p *PostgresPersister) loadModelGovernance(ctx context.Context, snapshot *Snapshot) error {
	modelProfileRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, provider, model_name, capability_type, region,
		       COALESCE(supported_input_locales, ARRAY[]::text[]),
		       COALESCE(supported_output_locales, ARRAY[]::text[]),
		       COALESCE(pricing_snapshot::text, '{}'),
		       COALESCE(rate_limit_policy::text, '{}'),
		       status, created_at, updated_at
		FROM model_profiles
	`)
	if err != nil {
		return fmt.Errorf("db: load model profiles: %w", err)
	}
	defer modelProfileRows.Close()
	for modelProfileRows.Next() {
		var (
			record                 modelgovernance.ModelProfile
			supportedInputLocales  pq.StringArray
			supportedOutputLocales pq.StringArray
		)
		if err := modelProfileRows.Scan(&record.ID, &record.Provider, &record.ModelName, &record.CapabilityType, &record.Region, &supportedInputLocales, &supportedOutputLocales, &record.PricingSnapshotJSON, &record.RateLimitPolicyJSON, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan model profile: %w", err)
		}
		record.SupportedInputLocales = append([]string(nil), supportedInputLocales...)
		record.SupportedOutputLocales = append([]string(nil), supportedOutputLocales...)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.ModelProfiles[record.ID] = record
	}
	if err := modelProfileRows.Err(); err != nil {
		return fmt.Errorf("db: iterate model profiles: %w", err)
	}

	promptTemplateRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, template_family, template_key, locale, version, content,
		       COALESCE(input_schema::text, '{}'), COALESCE(output_schema::text, '{}'),
		       status, created_at, updated_at
		FROM prompt_templates
	`)
	if err != nil {
		return fmt.Errorf("db: load prompt templates: %w", err)
	}
	defer promptTemplateRows.Close()
	for promptTemplateRows.Next() {
		var record modelgovernance.PromptTemplate
		if err := promptTemplateRows.Scan(&record.ID, &record.TemplateFamily, &record.TemplateKey, &record.Locale, &record.Version, &record.Content, &record.InputSchemaJSON, &record.OutputSchemaJSON, &record.Status, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan prompt template: %w", err)
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.PromptTemplates[record.ID] = record
	}
	if err := promptTemplateRows.Err(); err != nil {
		return fmt.Errorf("db: iterate prompt templates: %w", err)
	}

	contextBundleRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(shot_id::text, ''),
		       COALESCE(model_profile_id::text, ''), COALESCE(prompt_template_id::text, ''),
		       input_locale, output_locale, COALESCE(resolved_prompt_version, 0),
		       ARRAY(SELECT unnest(COALESCE(source_snapshot_ids, ARRAY[]::uuid[]))::text),
		       ARRAY(SELECT unnest(COALESCE(referenced_asset_ids, ARRAY[]::uuid[]))::text),
		       COALESCE(payload::text, '{}'), COALESCE(created_by_user_id::text, ''), created_at
		FROM context_bundles
	`)
	if err != nil {
		return fmt.Errorf("db: load context bundles: %w", err)
	}
	defer contextBundleRows.Close()
	for contextBundleRows.Next() {
		var (
			record             modelgovernance.ContextBundle
			sourceSnapshotIDs  pq.StringArray
			referencedAssetIDs pq.StringArray
		)
		if err := contextBundleRows.Scan(&record.ID, &record.OrganizationID, &record.ProjectID, &record.ShotID, &record.ModelProfileID, &record.PromptTemplateID, &record.InputLocale, &record.OutputLocale, &record.ResolvedPromptVersion, &sourceSnapshotIDs, &referencedAssetIDs, &record.PayloadJSON, &record.CreatedByUserID, &record.CreatedAt); err != nil {
			return fmt.Errorf("db: scan context bundle: %w", err)
		}
		record.SourceSnapshotIDs = append([]string(nil), sourceSnapshotIDs...)
		record.ReferencedAssetIDs = append([]string(nil), referencedAssetIDs...)
		record.CreatedAt = record.CreatedAt.UTC()
		snapshot.ContextBundles[record.ID] = record
	}
	if err := contextBundleRows.Err(); err != nil {
		return fmt.Errorf("db: iterate context bundles: %w", err)
	}

	return nil
}

func (p *PostgresPersister) saveModelGovernance(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.ModelProfiles {
		createdAt := record.CreatedAt
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}
		updatedAt := record.UpdatedAt
		if updatedAt.IsZero() {
			updatedAt = createdAt
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO model_profiles (
				id, provider, model_name, capability_type, region,
				supported_input_locales, supported_output_locales, pricing_snapshot,
				rate_limit_policy, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
		`, record.ID, record.Provider, record.ModelName, record.CapabilityType, record.Region, pq.Array(record.SupportedInputLocales), pq.Array(record.SupportedOutputLocales), defaultJSON(record.PricingSnapshotJSON), defaultJSON(record.RateLimitPolicyJSON), defaultString(record.Status, "active"), createdAt, updatedAt); err != nil {
			return fmt.Errorf("db: insert model profile %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.PromptTemplates {
		createdAt := record.CreatedAt
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}
		updatedAt := record.UpdatedAt
		if updatedAt.IsZero() {
			updatedAt = createdAt
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO prompt_templates (
				id, template_family, template_key, locale, version, content,
				input_schema, output_schema, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
		`, record.ID, record.TemplateFamily, record.TemplateKey, record.Locale, record.Version, record.Content, defaultJSON(record.InputSchemaJSON), defaultJSON(record.OutputSchemaJSON), defaultString(record.Status, "draft"), createdAt, updatedAt); err != nil {
			return fmt.Errorf("db: insert prompt template %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.ContextBundles {
		createdAt := record.CreatedAt
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO context_bundles (
				id, organization_id, project_id, shot_id, model_profile_id,
				prompt_template_id, input_locale, output_locale, resolved_prompt_version,
				source_snapshot_ids, referenced_asset_ids, payload, created_by_user_id, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $14)
		`, record.ID, record.OrganizationID, record.ProjectID, nullableUUID(record.ShotID), nullableUUID(record.ModelProfileID), nullableUUID(record.PromptTemplateID), record.InputLocale, record.OutputLocale, nullableInt(record.ResolvedPromptVersion), pq.Array(record.SourceSnapshotIDs), pq.Array(record.ReferencedAssetIDs), defaultJSON(record.PayloadJSON), nullableUUID(record.CreatedByUserID), createdAt); err != nil {
			return fmt.Errorf("db: insert context bundle %s: %w", record.ID, err)
		}
	}

	return nil
}
