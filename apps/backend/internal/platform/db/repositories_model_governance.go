package db

import (
	"context"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
)

func (*MemoryStore) GenerateModelProfileID() string   { return uuid.NewString() }
func (*MemoryStore) GeneratePromptTemplateID() string { return uuid.NewString() }
func (*MemoryStore) GenerateContextBundleID() string  { return uuid.NewString() }

func (s *MemoryStore) SaveModelProfile(ctx context.Context, record modelgovernance.ModelProfile) error {
	return s.save(ctx, func() {
		s.ModelProfiles[record.ID] = cloneModelProfile(record)
	})
}

func (s *MemoryStore) GetModelProfile(modelProfileID string) (modelgovernance.ModelProfile, bool) {
	record, ok := s.ModelProfiles[modelProfileID]
	return cloneModelProfile(record), ok
}

func (s *MemoryStore) ListModelProfiles(orgID string, capabilityType string, status string) []modelgovernance.ModelProfile {
	items := make([]modelgovernance.ModelProfile, 0)
	for _, record := range s.ModelProfiles {
		if strings.TrimSpace(orgID) != "" && strings.TrimSpace(record.OrganizationID) != strings.TrimSpace(orgID) {
			continue
		}
		if strings.TrimSpace(capabilityType) != "" && strings.TrimSpace(record.CapabilityType) != strings.TrimSpace(capabilityType) {
			continue
		}
		if strings.TrimSpace(status) != "" && strings.TrimSpace(record.Status) != strings.TrimSpace(status) {
			continue
		}
		items = append(items, cloneModelProfile(record))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		if items[i].CreatedAt.IsZero() || items[j].CreatedAt.IsZero() {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items
}

func (s *MemoryStore) SavePromptTemplate(ctx context.Context, record modelgovernance.PromptTemplate) error {
	return s.save(ctx, func() {
		s.PromptTemplates[record.ID] = clonePromptTemplate(record)
	})
}

func (s *MemoryStore) GetPromptTemplate(promptTemplateID string) (modelgovernance.PromptTemplate, bool) {
	record, ok := s.PromptTemplates[promptTemplateID]
	return clonePromptTemplate(record), ok
}

func (s *MemoryStore) ListPromptTemplates(orgID string, templateKey string, locale string, status string) []modelgovernance.PromptTemplate {
	items := make([]modelgovernance.PromptTemplate, 0)
	for _, record := range s.PromptTemplates {
		if strings.TrimSpace(orgID) != "" && strings.TrimSpace(record.OrganizationID) != strings.TrimSpace(orgID) {
			continue
		}
		if strings.TrimSpace(templateKey) != "" && strings.TrimSpace(record.TemplateKey) != strings.TrimSpace(templateKey) {
			continue
		}
		if strings.TrimSpace(locale) != "" && strings.TrimSpace(record.Locale) != strings.TrimSpace(locale) {
			continue
		}
		if strings.TrimSpace(status) != "" && strings.TrimSpace(record.Status) != strings.TrimSpace(status) {
			continue
		}
		items = append(items, clonePromptTemplate(record))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].TemplateKey == items[j].TemplateKey {
			if items[i].Locale == items[j].Locale {
				if items[i].Version == items[j].Version {
					return items[i].ID < items[j].ID
				}
				return items[i].Version < items[j].Version
			}
			return items[i].Locale < items[j].Locale
		}
		return items[i].TemplateKey < items[j].TemplateKey
	})
	return items
}

func (s *MemoryStore) SaveContextBundle(ctx context.Context, record modelgovernance.ContextBundle) error {
	return s.save(ctx, func() {
		s.ContextBundles[record.ID] = cloneContextBundle(record)
	})
}

func (s *MemoryStore) GetContextBundle(contextBundleID string) (modelgovernance.ContextBundle, bool) {
	record, ok := s.ContextBundles[contextBundleID]
	return cloneContextBundle(record), ok
}

func (s *MemoryStore) ListContextBundles(orgID string, projectID string, shotID string, shotExecutionID string, modelProfileID string, promptTemplateID string) []modelgovernance.ContextBundle {
	items := make([]modelgovernance.ContextBundle, 0)
	for _, record := range s.ContextBundles {
		if strings.TrimSpace(orgID) != "" && strings.TrimSpace(record.OrganizationID) != strings.TrimSpace(orgID) {
			continue
		}
		if strings.TrimSpace(projectID) != "" && strings.TrimSpace(record.ProjectID) != strings.TrimSpace(projectID) {
			continue
		}
		if strings.TrimSpace(shotID) != "" && strings.TrimSpace(record.ShotID) != strings.TrimSpace(shotID) {
			continue
		}
		if strings.TrimSpace(shotExecutionID) != "" && strings.TrimSpace(record.ShotExecutionID) != strings.TrimSpace(shotExecutionID) {
			continue
		}
		if strings.TrimSpace(modelProfileID) != "" && strings.TrimSpace(record.ModelProfileID) != strings.TrimSpace(modelProfileID) {
			continue
		}
		if strings.TrimSpace(promptTemplateID) != "" && strings.TrimSpace(record.PromptTemplateID) != strings.TrimSpace(promptTemplateID) {
			continue
		}
		items = append(items, cloneContextBundle(record))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		if items[i].CreatedAt.IsZero() || items[j].CreatedAt.IsZero() {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	return items
}

func cloneModelProfile(record modelgovernance.ModelProfile) modelgovernance.ModelProfile {
	record.SupportedInputLocales = append([]string(nil), record.SupportedInputLocales...)
	record.SupportedOutputLocales = append([]string(nil), record.SupportedOutputLocales...)
	return record
}

func clonePromptTemplate(record modelgovernance.PromptTemplate) modelgovernance.PromptTemplate {
	return record
}

func cloneContextBundle(record modelgovernance.ContextBundle) modelgovernance.ContextBundle {
	record.SourceSnapshotIDs = append([]string(nil), record.SourceSnapshotIDs...)
	record.ReferencedAssetIDs = append([]string(nil), record.ReferencedAssetIDs...)
	return record
}
