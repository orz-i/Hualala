package auth

type Session struct {
	SessionID       string
	UserID          string
	OrgID           string
	Locale          string
	RoleID          string
	RoleCode        string
	PermissionCodes []string
	Timezone        string
}

type User struct {
	ID                string
	Email             string
	DisplayName       string
	PreferredUILocale string
	Timezone          string
}

type UserPreferences struct {
	UserID        string
	DisplayLocale string
	Timezone      string
}
