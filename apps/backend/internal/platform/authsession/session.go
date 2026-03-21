package authsession

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"os"
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

var signingKey = loadSigningKey()

type Principal struct {
	OrgID  string
	UserID string
}

func BuildRequestCookieHeader(orgID string, userID string) string {
	encoded := encodePrincipal(orgID, userID)
	return SessionCookieName + "=" + encoded + "; " + RefreshPrincipalCookieName + "=" + encoded
}

func SetDevSessionCookies(header http.Header, orgID string, userID string, secure bool) {
	encoded := encodePrincipal(orgID, userID)
	header.Add("Set-Cookie", (&http.Cookie{
		Name:     SessionCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   sessionMaxAgeSeconds,
		Expires:  time.Now().UTC().Add(time.Duration(sessionMaxAgeSeconds) * time.Second),
	}).String())
	header.Add("Set-Cookie", (&http.Cookie{
		Name:     RefreshPrincipalCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   refreshMaxAgeSeconds,
		Expires:  time.Now().UTC().Add(time.Duration(refreshMaxAgeSeconds) * time.Second),
	}).String())
}

func ClearDevSessionCookies(header http.Header, secure bool) {
	clearCookie := func(name string) {
		header.Add("Set-Cookie", (&http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secure,
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
	payload := strings.TrimSpace(orgID) + "\n" + strings.TrimSpace(userID)
	encodedPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	signature := signEncodedPayload(encodedPayload)
	return encodedPayload + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func decodePrincipal(value string) (string, string, bool) {
	parts := strings.SplitN(strings.TrimSpace(value), ".", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	encodedPayload := strings.TrimSpace(parts[0])
	providedSignature, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(parts[1]))
	if err != nil {
		return "", "", false
	}
	expectedSignature := signEncodedPayload(encodedPayload)
	if !hmac.Equal(providedSignature, expectedSignature) {
		return "", "", false
	}
	payload, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return "", "", false
	}
	payloadParts := strings.SplitN(strings.TrimSpace(string(payload)), "\n", 2)
	if len(payloadParts) != 2 {
		return "", "", false
	}
	orgID := strings.TrimSpace(payloadParts[0])
	userID := strings.TrimSpace(payloadParts[1])
	if orgID == "" || userID == "" {
		return "", "", false
	}
	return orgID, userID, true
}

func ShouldUseSecureCookies(header http.Header) bool {
	proto := strings.ToLower(strings.TrimSpace(header.Get("X-Forwarded-Proto")))
	if proto == "https" {
		return true
	}
	forwarded := strings.ToLower(strings.TrimSpace(header.Get("Forwarded")))
	return strings.Contains(forwarded, "proto=https")
}

func signEncodedPayload(encodedPayload string) []byte {
	mac := hmac.New(sha256.New, signingKey)
	mac.Write([]byte(encodedPayload))
	return mac.Sum(nil)
}

func loadSigningKey() []byte {
	if envValue := strings.TrimSpace(os.Getenv("HUALALA_DEV_SESSION_SECRET")); envValue != "" {
		return []byte(envValue)
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic("authsession: failed to generate signing key")
	}
	return key
}
