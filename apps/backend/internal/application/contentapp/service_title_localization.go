package contentapp

import (
	"errors"
	"strings"

	"github.com/hualala/apps/backend/internal/application/titlelocalization"
	"github.com/hualala/apps/backend/internal/domain/content"
)

func normalizeSnapshotKind(snapshotKind string) (string, error) {
	normalizedSnapshotKind := strings.TrimSpace(snapshotKind)
	if normalizedSnapshotKind == "" {
		return content.SnapshotKindContent, nil
	}
	switch normalizedSnapshotKind {
	case content.SnapshotKindContent, content.SnapshotKindTitle:
		return normalizedSnapshotKind, nil
	default:
		return "", errors.New("contentapp: invalid argument: snapshot_kind must be content or title")
	}
}

func normalizeStoredSnapshotKind(snapshotKind string) (string, error) {
	return normalizeSnapshotKind(snapshotKind)
}

func (s *Service) validateSnapshotOwner(snapshotKind string, ownerType string) error {
	if snapshotKind != content.SnapshotKindTitle {
		return nil
	}
	switch strings.TrimSpace(ownerType) {
	case "scene", "shot":
		return nil
	default:
		return errors.New("contentapp: invalid argument: snapshot_kind=title only supports owner_type scene or shot")
	}
}

func (s *Service) resolveSceneTitles(records []content.Scene, displayLocale string) []content.Scene {
	normalizedLocale := strings.TrimSpace(displayLocale)
	if normalizedLocale == "" || len(records) == 0 {
		return records
	}
	sceneIDs := make([]string, 0, len(records))
	for _, record := range records {
		sceneIDs = append(sceneIDs, record.ID)
	}
	titlesBySceneID := titlelocalization.TitlesByOwnerID(s.repo.ListSnapshotsByOwners("scene", sceneIDs), normalizedLocale)
	items := append([]content.Scene(nil), records...)
	for index := range items {
		if localizedTitle, ok := titlesBySceneID[items[index].ID]; ok {
			items[index].Title = localizedTitle
		}
	}
	return items
}

func (s *Service) resolveSceneTitle(record content.Scene, displayLocale string) content.Scene {
	items := s.resolveSceneTitles([]content.Scene{record}, displayLocale)
	if len(items) == 0 {
		return record
	}
	return items[0]
}

func (s *Service) resolveShotTitles(records []content.Shot, displayLocale string) []content.Shot {
	normalizedLocale := strings.TrimSpace(displayLocale)
	if normalizedLocale == "" || len(records) == 0 {
		return records
	}
	shotIDs := make([]string, 0, len(records))
	for _, record := range records {
		shotIDs = append(shotIDs, record.ID)
	}
	titlesByShotID := titlelocalization.TitlesByOwnerID(s.repo.ListSnapshotsByOwners("shot", shotIDs), normalizedLocale)
	items := append([]content.Shot(nil), records...)
	for index := range items {
		if localizedTitle, ok := titlesByShotID[items[index].ID]; ok {
			items[index].Title = localizedTitle
		}
	}
	return items
}

func (s *Service) resolveShotTitle(record content.Shot, displayLocale string) content.Shot {
	items := s.resolveShotTitles([]content.Shot{record}, displayLocale)
	if len(items) == 0 {
		return record
	}
	return items[0]
}
