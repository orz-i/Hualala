package asset

import "strings"

func NormalizeConsentStatus(aiAnnotated bool, consentStatus string) string {
	normalized := strings.TrimSpace(consentStatus)
	if normalized == "" {
		normalized = "unknown"
	}
	if !aiAnnotated && normalized == "unknown" {
		return "not_required"
	}
	return normalized
}
