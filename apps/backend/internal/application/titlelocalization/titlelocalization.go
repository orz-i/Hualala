package titlelocalization

import (
	"strings"

	"github.com/hualala/apps/backend/internal/domain/content"
)

func TitlesByOwnerID(snapshots []content.Snapshot, displayLocale string) map[string]string {
	normalizedLocale := strings.TrimSpace(displayLocale)
	if normalizedLocale == "" || len(snapshots) == 0 {
		return map[string]string{}
	}
	selectedByOwnerID := make(map[string]content.Snapshot)
	titlesByOwnerID := make(map[string]string)
	for _, snapshot := range snapshots {
		if strings.TrimSpace(snapshot.SnapshotKind) != content.SnapshotKindTitle {
			continue
		}
		if strings.TrimSpace(snapshot.Locale) != normalizedLocale {
			continue
		}
		title := strings.TrimSpace(snapshot.Body)
		if title == "" {
			continue
		}
		existing, ok := selectedByOwnerID[snapshot.OwnerID]
		if ok {
			switch {
			case snapshot.UpdatedAt.Before(existing.UpdatedAt):
				continue
			// Equal timestamps do not carry extra business meaning here.
			// Prefer the lexicographically larger ID only to keep selection deterministic.
			case snapshot.UpdatedAt.Equal(existing.UpdatedAt) && snapshot.ID <= existing.ID:
				continue
			}
		}
		selectedByOwnerID[snapshot.OwnerID] = snapshot
		titlesByOwnerID[snapshot.OwnerID] = title
	}
	return titlesByOwnerID
}

func ResolveTitle(titlesByOwnerID map[string]string, ownerID string, fallback string) string {
	if title, ok := titlesByOwnerID[strings.TrimSpace(ownerID)]; ok {
		return title
	}
	return strings.TrimSpace(fallback)
}
