package modelgovernance

import "time"

type ModelProfile struct {
	ID                     string
	OrganizationID         string
	Provider               string
	ModelName              string
	CapabilityType         string
	Region                 string
	SupportedInputLocales  []string
	SupportedOutputLocales []string
	PricingSnapshotJSON    string
	RateLimitPolicyJSON    string
	Status                 string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type PromptTemplate struct {
	ID               string
	OrganizationID   string
	TemplateFamily   string
	TemplateKey      string
	Locale           string
	Version          int
	Content          string
	InputSchemaJSON  string
	OutputSchemaJSON string
	Status           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type ContextBundle struct {
	ID                    string
	OrganizationID        string
	ProjectID             string
	ShotID                string
	ShotExecutionID       string
	ModelProfileID        string
	PromptTemplateID      string
	InputLocale           string
	OutputLocale          string
	ResolvedPromptVersion int
	SourceSnapshotIDs     []string
	ReferencedAssetIDs    []string
	PayloadJSON           string
	CreatedByUserID       string
	CreatedAt             time.Time
}
