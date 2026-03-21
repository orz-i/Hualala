package authsession

import (
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	SessionCookieName        = "hualala_dev_session"
	RefreshPrincipalCookieName = "hualala_dev_refresh_principal"
	DevRefreshToken          = "dev-refresh"
	sessionMaxAgeSeconds     = 8 * 60 * 60
	refreshMaxAgeSeconds     = 7 * 24 * 60 * 60
)

type Principal struct {
	OrgID  string
	UserID string
}

func BuildRequestCookieHeader(orgID string, userID string) string {
	encoded := encodePrincipal(orgID, userID)
	return SessionCookieName + "=" + encoded + "; " + RefreshPrincipalCookieName + "=" + encoded
}

func SetDevSessionCookies(header http.Header, orgID string, userID string) {
	encoded := encodePrincipal(orgID, userID)
	header.Add("Set-Cookie", (&http.Cookie{
		Name:     SessionCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   sessionMaxAgeSeconds,
		Expires:  time.Now().UTC().Add(time.Duration(sessionMaxAgeSeconds) * time.Second),
	}).String())
	header.Add("Set-Cookie", (&http.Cookie{
		Name:     RefreshPrincipalCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   refreshMaxAgeSeconds,
		Expires:  time.Now().UTC().Add(time.Duration(refreshMaxAgeSeconds) * time.Second),
	}).String())
}

func ClearDevSessionCookies(header http.Header) {
	clearCookie := func(name string) {
		header.Add("Set-Cookie", (&http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Expires:  time.Unix(0, 0).UTC(),
		}).String())
	}
	clearCookie(SessionCookieName)
	clearCookie(RefreshPrincipalCookieName)
}

func ResolvePrincipal(cookieHeader string) (Principal, bool) {
	return parseCookiePrincipal(cookieHeader, SessionCookieName)
}

func ResolveRefreshPrincipal(cookieHeader string, refreshToken string) (Principal, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return Principal{}, errors.New("authsession: refresh_token is required")
	}
	if strings.TrimSpace(refreshToken) != DevRefreshToken {
		return Principal{}, errors.New("authsession: refresh_token is invalid")
	}
	principal, ok := parseCookiePrincipal(cookieHeader, RefreshPrincipalCookieName)
	if !ok {
		return Principal{}, errors.New("authsession: refresh principal is unavailable")
	}
	return principal, nil
}

func parseCookiePrincipal(cookieHeader string, name string) (Principal, bool) {
	value := readCookie(cookieHeader, name)
	if value == "" {
		return Principal{}, false
	}
	orgID, userID, ok := decodePrincipal(value)
	if !ok {
		return Principal{}, false
	}
	return Principal{
		OrgID:  orgID,
		UserID: userID,
	}, true
}

func readCookie(cookieHeader string, name string) string {
	for _, part := range strings.Split(cookieHeader, ";") {
		pair := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(pair) != 2 {
			continue
		}
		if strings.TrimSpace(pair[0]) == name {
			return strings.TrimSpace(pair[1])
		}
	}
	return ""
}

func encodePrincipal(orgID string, userID string) string {
	return strings.TrimSpace(orgID) + ":" + strings.TrimSpace(userID)
}

func decodePrincipal(value string) (string, string, bool) {
	parts := strings.SplitN(strings.TrimSpace(value), ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	orgID := strings.TrimSpace(parts[0])
	userID := strings.TrimSpace(parts[1])
	if orgID == "" || userID == "" {
		return "", "", false
	}
	return orgID, userID, true
}
