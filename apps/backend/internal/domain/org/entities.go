package org

type Organization struct {
	ID                   string
	Slug                 string
	DisplayName          string
	DefaultUILocale      string
	DefaultContentLocale string
}

type Member struct {
	ID     string
	OrgID  string
	UserID string
	RoleID string
	Status string
}

type Role struct {
	ID              string
	OrgID           string
	Code            string
	DisplayName     string
	PermissionCodes []string
}

type OrgLocaleSettings struct {
	OrgID            string
	DefaultLocale    string
	SupportedLocales []string
}

type AvailablePermission struct {
	Code        string
	DisplayName string
	Group       string
}
