package authsession

import (
	"net/http"
	"strings"
	"testing"
)

func TestSetDevSessionCookiesSetsSecureFlagWhenRequested(t *testing.T) {
	header := http.Header{}

	SetDevSessionCookies(header, "org-1", "user-1", true)

	values := header.Values("Set-Cookie")
	if len(values) != 2 {
		t.Fatalf("expected 2 session cookies, got %d", len(values))
	}
	for _, value := range values {
		if !strings.Contains(value, "Secure") {
			t.Fatalf("expected Set-Cookie %q to include Secure", value)
		}
	}
}

func TestResolvePrincipalRejectsForgedCookieValue(t *testing.T) {
	cookieHeader := SessionCookieName + "=org-1:user-2; " + RefreshPrincipalCookieName + "=org-1:user-2"

	principal, ok := ResolvePrincipal(cookieHeader)
	if ok {
		t.Fatalf("expected forged cookie to be rejected, got principal %#v", principal)
	}
}

func TestResolveRefreshPrincipalRejectsForgedCookieValue(t *testing.T) {
	cookieHeader := SessionCookieName + "=org-1:user-2; " + RefreshPrincipalCookieName + "=org-1:user-2"

	principal, err := ResolveRefreshPrincipal(cookieHeader, DevRefreshToken)
	if err == nil {
		t.Fatalf("expected forged refresh cookie to be rejected, got principal %#v", principal)
	}
}
