package connect

import (
	"context"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

	connectrpc "connectrpc.com/connect"
	authv1 "github.com/hualala/apps/backend/gen/hualala/auth/v1"
	authv1connect "github.com/hualala/apps/backend/gen/hualala/auth/v1/authv1connect"
	orgv1 "github.com/hualala/apps/backend/gen/hualala/org/v1"
	orgv1connect "github.com/hualala/apps/backend/gen/hualala/org/v1/orgv1connect"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

func TestAuthAndOrgRoutes(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	seedAuthOrgRuntimeStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	defer server.Close()

	authClient := authv1connect.NewAuthServiceClient(server.Client(), server.URL)
	orgClient := orgv1connect.NewOrgServiceClient(server.Client(), server.URL)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookiejar.New returned error: %v", err)
	}
	server.Client().Jar = jar
	authClient = authv1connect.NewAuthServiceClient(server.Client(), server.URL)
	orgClient = orgv1connect.NewOrgServiceClient(server.Client(), server.URL)

	_, err = authClient.GetCurrentSession(ctx, connectrpc.NewRequest(&authv1.GetCurrentSessionRequest{}))
	if err == nil {
		t.Fatalf("expected unauthenticated error before starting dev session")
	}

	startResp, err := authClient.StartDevSession(ctx, connectrpc.NewRequest(&authv1.StartDevSessionRequest{}))
	if err != nil {
		t.Fatalf("StartDevSession returned error: %v", err)
	}
	if got := startResp.Msg.GetSession().GetUserId(); got != db.DefaultDevUserID {
		t.Fatalf("expected dev user %q, got %q", db.DefaultDevUserID, got)
	}

	sessionResp, err := authClient.GetCurrentSession(ctx, connectrpc.NewRequest(&authv1.GetCurrentSessionRequest{}))
	if err != nil {
		t.Fatalf("GetCurrentSession returned error: %v", err)
	}
	if got := sessionResp.Msg.GetSession().GetUserId(); got != db.DefaultDevUserID {
		t.Fatalf("expected dev user %q, got %q", db.DefaultDevUserID, got)
	}

	updateReq := connectrpc.NewRequest(&authv1.UpdateUserPreferencesRequest{
		UserId:        db.DefaultDevUserID,
		DisplayLocale: "en-US",
		Timezone:      "America/Los_Angeles",
	})
	updateResp, err := authClient.UpdateUserPreferences(ctx, updateReq)
	if err != nil {
		t.Fatalf("UpdateUserPreferences returned error: %v", err)
	}
	if got := updateResp.Msg.GetPreferences().GetDisplayLocale(); got != "en-US" {
		t.Fatalf("expected updated locale en-US, got %q", got)
	}

	membersReq := connectrpc.NewRequest(&orgv1.ListMembersRequest{OrgId: db.DefaultDevOrganizationID})
	membersResp, err := orgClient.ListMembers(ctx, membersReq)
	if err != nil {
		t.Fatalf("ListMembers returned error: %v", err)
	}
	if len(membersResp.Msg.GetMembers()) != 1 {
		t.Fatalf("expected 1 member, got %d", len(membersResp.Msg.GetMembers()))
	}

	store.Users["77777777-7777-7777-7777-777777777777"] = auth.User{
		ID:                "77777777-7777-7777-7777-777777777777",
		Email:             "backup-admin@hualala.local",
		DisplayName:       "Backup Admin",
		PreferredUILocale: "zh-CN",
	}
	store.Memberships["88888888-8888-8888-8888-888888888888"] = org.Member{
		ID:     "88888888-8888-8888-8888-888888888888",
		OrgID:  db.DefaultDevOrganizationID,
		UserID: "77777777-7777-7777-7777-777777777777",
		RoleID: db.DefaultDevRoleID,
		Status: "active",
	}

	roleUpdateReq := connectrpc.NewRequest(&orgv1.UpdateMemberRoleRequest{
		OrgId:    db.DefaultDevOrganizationID,
		MemberId: db.DefaultDevMembershipID,
		RoleId:   "55555555-5555-5555-5555-555555555555",
	})
	roleUpdateResp, err := orgClient.UpdateMemberRole(ctx, roleUpdateReq)
	if err != nil {
		t.Fatalf("UpdateMemberRole returned error: %v", err)
	}
	if got := roleUpdateResp.Msg.GetMember().GetRoleId(); got != "55555555-5555-5555-5555-555555555555" {
		t.Fatalf("expected updated role id, got %q", got)
	}

	_, err = authClient.ClearCurrentSession(ctx, connectrpc.NewRequest(&authv1.ClearCurrentSessionRequest{}))
	if err != nil {
		t.Fatalf("ClearCurrentSession returned error: %v", err)
	}
	_, err = authClient.GetCurrentSession(ctx, connectrpc.NewRequest(&authv1.GetCurrentSessionRequest{}))
	if err == nil {
		t.Fatalf("expected unauthenticated error after clearing current session")
	}
}

func TestOrgRouteRejectsMissingPermission(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	seedAuthOrgRuntimeStore(store)
	store.RolePermissions[db.DefaultDevRoleID] = []string{"session.read"}

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	defer server.Close()

	orgClient := orgv1connect.NewOrgServiceClient(server.Client(), server.URL)
	req := connectrpc.NewRequest(&orgv1.UpdateOrgLocaleSettingsRequest{
		OrgId:         db.DefaultDevOrganizationID,
		DefaultLocale: "en-US",
	})
	req.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
	req.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
	_, err := orgClient.UpdateOrgLocaleSettings(ctx, req)
	if err == nil {
		t.Fatalf("expected permission denied error")
	}
}

func TestStartDevSessionSetsSecureCookiesForForwardedHTTPS(t *testing.T) {
	store := db.NewMemoryStore()
	seedAuthOrgRuntimeStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	defer server.Close()

	req, err := http.NewRequest(http.MethodPost, server.URL+"/hualala.auth.v1.AuthService/StartDevSession", strings.NewReader("{}"))
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Connect-Protocol-Version", "1")
	req.Header.Set("X-Forwarded-Proto", "https")

	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 response, got %d", resp.StatusCode)
	}
	values := resp.Header.Values("Set-Cookie")
	if len(values) == 0 {
		t.Fatalf("expected Set-Cookie headers to be present")
	}
	for _, value := range values {
		if !strings.Contains(value, "Secure") {
			t.Fatalf("expected Set-Cookie %q to include Secure", value)
		}
	}
}

func seedAuthOrgRuntimeStore(store *db.MemoryStore) {
	store.Organizations[db.DefaultDevOrganizationID] = org.Organization{
		ID:                   db.DefaultDevOrganizationID,
		Slug:                 "dev-org",
		DisplayName:          "Development Organization",
		DefaultUILocale:      "zh-CN",
		DefaultContentLocale: "zh-CN",
	}
	store.Users[db.DefaultDevUserID] = auth.User{
		ID:                db.DefaultDevUserID,
		Email:             "dev-user@hualala.local",
		DisplayName:       "Development Operator",
		PreferredUILocale: "zh-CN",
	}
	store.Roles[db.DefaultDevRoleID] = org.Role{
		ID:          db.DefaultDevRoleID,
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "admin",
		DisplayName: "Administrator",
	}
	store.Roles["55555555-5555-5555-5555-555555555555"] = org.Role{
		ID:          "55555555-5555-5555-5555-555555555555",
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "editor",
		DisplayName: "Editor",
	}
	store.Memberships[db.DefaultDevMembershipID] = org.Member{
		ID:     db.DefaultDevMembershipID,
		OrgID:  db.DefaultDevOrganizationID,
		UserID: db.DefaultDevUserID,
		RoleID: db.DefaultDevRoleID,
		Status: "active",
	}
	store.RolePermissions[db.DefaultDevRoleID] = []string{
		"session.read",
		"user.preferences.write",
		"org.members.read",
		"org.roles.read",
		"org.members.write",
		"org.settings.write",
		"org.roles.write",
		"org.model_governance.read",
		"org.model_governance.write",
	}
}
