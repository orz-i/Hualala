package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
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
	updateReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
	updateReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
	updateResp, err := authClient.UpdateUserPreferences(ctx, updateReq)
	if err != nil {
		t.Fatalf("UpdateUserPreferences returned error: %v", err)
	}
	if got := updateResp.Msg.GetPreferences().GetDisplayLocale(); got != "en-US" {
		t.Fatalf("expected updated locale en-US, got %q", got)
	}

	membersReq := connectrpc.NewRequest(&orgv1.ListMembersRequest{OrgId: db.DefaultDevOrganizationID})
	membersReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
	membersReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
	membersResp, err := orgClient.ListMembers(ctx, membersReq)
	if err != nil {
		t.Fatalf("ListMembers returned error: %v", err)
	}
	if len(membersResp.Msg.GetMembers()) != 1 {
		t.Fatalf("expected 1 member, got %d", len(membersResp.Msg.GetMembers()))
	}

	roleUpdateReq := connectrpc.NewRequest(&orgv1.UpdateMemberRoleRequest{
		OrgId:    db.DefaultDevOrganizationID,
		MemberId: db.DefaultDevMembershipID,
		RoleId:   "55555555-5555-5555-5555-555555555555",
	})
	roleUpdateReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
	roleUpdateReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
	roleUpdateResp, err := orgClient.UpdateMemberRole(ctx, roleUpdateReq)
	if err != nil {
		t.Fatalf("UpdateMemberRole returned error: %v", err)
	}
	if got := roleUpdateResp.Msg.GetMember().GetRoleId(); got != "55555555-5555-5555-5555-555555555555" {
		t.Fatalf("expected updated role id, got %q", got)
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
	}
}
