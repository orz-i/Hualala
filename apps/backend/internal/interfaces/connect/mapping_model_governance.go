package connect

import (
	modelv1 "github.com/hualala/apps/backend/gen/hualala/model/v1"
	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
)

func mapModelProfile(record modelgovernance.ModelProfile) *modelv1.ModelProfile {
	return &modelv1.ModelProfile{
		Id:                     record.ID,
		OrgId:                  record.OrganizationID,
		Provider:               record.Provider,
		ModelName:              record.ModelName,
		CapabilityType:         record.CapabilityType,
		Region:                 record.Region,
		SupportedInputLocales:  append([]string(nil), record.SupportedInputLocales...),
		SupportedOutputLocales: append([]string(nil), record.SupportedOutputLocales...),
		PricingSnapshotJson:    record.PricingSnapshotJSON,
		RateLimitPolicyJson:    record.RateLimitPolicyJSON,
		Status:                 record.Status,
		CreatedAt:              timestampOrNil(record.CreatedAt),
		UpdatedAt:              timestampOrNil(record.UpdatedAt),
	}
}

func mapPromptTemplate(record modelgovernance.PromptTemplate) *modelv1.PromptTemplate {
	return &modelv1.PromptTemplate{
		Id:               record.ID,
		OrgId:            record.OrganizationID,
		TemplateFamily:   record.TemplateFamily,
		TemplateKey:      record.TemplateKey,
		Locale:           record.Locale,
		Version:          uint32(record.Version),
		Content:          record.Content,
		InputSchemaJson:  record.InputSchemaJSON,
		OutputSchemaJson: record.OutputSchemaJSON,
		Status:           record.Status,
		CreatedAt:        timestampOrNil(record.CreatedAt),
		UpdatedAt:        timestampOrNil(record.UpdatedAt),
	}
}

func mapContextBundle(record modelgovernance.ContextBundle) *modelv1.ContextBundle {
	return &modelv1.ContextBundle{
		Id:                    record.ID,
		OrgId:                 record.OrganizationID,
		ProjectId:             record.ProjectID,
		ShotId:                record.ShotID,
		ShotExecutionId:       record.ShotExecutionID,
		ModelProfileId:        record.ModelProfileID,
		PromptTemplateId:      record.PromptTemplateID,
		InputLocale:           record.InputLocale,
		OutputLocale:          record.OutputLocale,
		ResolvedPromptVersion: uint32(record.ResolvedPromptVersion),
		SourceSnapshotIds:     append([]string(nil), record.SourceSnapshotIDs...),
		ReferencedAssetIds:    append([]string(nil), record.ReferencedAssetIDs...),
		PayloadJson:           record.PayloadJSON,
		CreatedByUserId:       record.CreatedByUserID,
		CreatedAt:             timestampOrNil(record.CreatedAt),
	}
}
