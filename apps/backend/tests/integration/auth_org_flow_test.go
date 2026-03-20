package integration

import (
	"context"
	"testing"

	connectrpc "connectrpc.com/connect"
	authv1 "github.com/hualala/apps/backend/gen/hualala/auth/v1"
	authv1connect "github.com/hualala/apps/backend/gen/hualala/auth/v1/authv1connect"
	orgv1 "github.com/hualala/apps/backend/gen/hualala/org/v1"
	orgv1connect "github.com/hualala/apps/backend/gen/hualala/org/v1/orgv1connect"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAuthOrgFlow(t *testing.T) {
	fixture := openIntegrationFixture(t)
	server := fixture.NewHTTPServer(t, nil)
	repos := fixture.Factory.Repositories()

	ctx := context.Background()
	authClient := authv1connect.NewAuthServiceClient(server.Client(), server.URL)
	orgClient := orgv1connect.NewOrgServiceClient(server.Client(), server.URL)

	t.Run("session fallback and refresh use bootstrap identity", func(t *testing.T) {
		sessionResp, err := authClient.GetCurrentSession(ctx, connectrpc.NewRequest(&authv1.GetCurrentSessionRequest{}))
		if err != nil {
			t.Fatalf("GetCurrentSession returned error: %v", err)
		}
		session := sessionResp.Msg.GetSession()
		if got := session.GetOrgId(); got != db.DefaultDevOrganizationID {
			t.Fatalf("expected default org %q, got %q", db.DefaultDevOrganizationID, got)
		}
		if got := session.GetUserId(); got != db.DefaultDevUserID {
			t.Fatalf("expected default user %q, got %q", db.DefaultDevUserID, got)
		}
		if got := session.GetSessionId(); got != "dev:"+db.DefaultDevOrganizationID+":"+db.DefaultDevUserID {
			t.Fatalf("expected stable dev session id, got %q", got)
		}

		refreshReq := connectrpc.NewRequest(&authv1.RefreshSessionRequest{RefreshToken: "dev-refresh"})
		refreshReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		refreshReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		refreshResp, err := authClient.RefreshSession(ctx, refreshReq)
		if err != nil {
			t.Fatalf("RefreshSession returned error: %v", err)
		}
		if got := refreshResp.Msg.GetSession().GetSessionId(); got != session.GetSessionId() {
			t.Fatalf("expected refresh to return same dev session id %q, got %q", session.GetSessionId(), got)
		}
	})

	t.Run("user preferences persist", func(t *testing.T) {
		req := connectrpc.NewRequest(&authv1.UpdateUserPreferencesRequest{
			UserId:        db.DefaultDevUserID,
			DisplayLocale: "en-US",
			Timezone:      "America/Los_Angeles",
		})
		req.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		req.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		resp, err := authClient.UpdateUserPreferences(ctx, req)
		if err != nil {
			t.Fatalf("UpdateUserPreferences returned error: %v", err)
		}
		if got := resp.Msg.GetPreferences().GetDisplayLocale(); got != "en-US" {
			t.Fatalf("expected display locale en-US, got %q", got)
		}
		if got := resp.Msg.GetPreferences().GetTimezone(); got != "America/Los_Angeles" {
			t.Fatalf("expected timezone America/Los_Angeles, got %q", got)
		}

		record, ok := repos.AuthOrg.GetUser(db.DefaultDevUserID)
		if !ok {
			t.Fatalf("expected updated user to exist")
		}
		if got := record.PreferredUILocale; got != "en-US" {
			t.Fatalf("expected persisted preferred ui locale en-US, got %q", got)
		}
		if got := record.Timezone; got != "America/Los_Angeles" {
			t.Fatalf("expected persisted timezone America/Los_Angeles, got %q", got)
		}
	})

	t.Run("members roles and org locale settings use authz and persist", func(t *testing.T) {
		editorRoleID := "55555555-5555-5555-5555-555555555555"
		if err := repos.AuthOrg.SaveRole(ctx, org.Role{
			ID:          editorRoleID,
			OrgID:       db.DefaultDevOrganizationID,
			Code:        "editor",
			DisplayName: "Editor",
		}); err != nil {
			t.Fatalf("SaveRole returned error: %v", err)
		}

		membersReq := connectrpc.NewRequest(&orgv1.ListMembersRequest{OrgId: db.DefaultDevOrganizationID})
		membersReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		membersReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		membersResp, err := orgClient.ListMembers(ctx, membersReq)
		if err != nil {
			t.Fatalf("ListMembers returned error: %v", err)
		}
		if len(membersResp.Msg.GetMembers()) != 1 {
			t.Fatalf("expected exactly 1 bootstrap member, got %d", len(membersResp.Msg.GetMembers()))
		}

		rolesReq := connectrpc.NewRequest(&orgv1.ListRolesRequest{OrgId: db.DefaultDevOrganizationID})
		rolesReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		rolesReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		rolesResp, err := orgClient.ListRoles(ctx, rolesReq)
		if err != nil {
			t.Fatalf("ListRoles returned error: %v", err)
		}
		if len(rolesResp.Msg.GetRoles()) < 2 {
			t.Fatalf("expected at least 2 roles after editor seed, got %d", len(rolesResp.Msg.GetRoles()))
		}

		localeReq := connectrpc.NewRequest(&orgv1.UpdateOrgLocaleSettingsRequest{
			OrgId:            db.DefaultDevOrganizationID,
			DefaultLocale:    "ja-JP",
			SupportedLocales: []string{"ja-JP", "en-US"},
		})
		localeReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		localeReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		localeResp, err := orgClient.UpdateOrgLocaleSettings(ctx, localeReq)
		if err != nil {
			t.Fatalf("UpdateOrgLocaleSettings returned error: %v", err)
		}
		settings := localeResp.Msg.GetLocaleSettings()
		if got := settings.GetDefaultLocale(); got != "ja-JP" {
			t.Fatalf("expected default locale ja-JP, got %q", got)
		}
		if len(settings.GetSupportedLocales()) != 1 || settings.GetSupportedLocales()[0] != "ja-JP" {
			t.Fatalf("expected supported_locales to echo only default locale ja-JP, got %#v", settings.GetSupportedLocales())
		}

		orgRecord, ok := repos.AuthOrg.GetOrganization(db.DefaultDevOrganizationID)
		if !ok {
			t.Fatalf("expected organization to exist")
		}
		if got := orgRecord.DefaultUILocale; got != "ja-JP" {
			t.Fatalf("expected persisted default ui locale ja-JP, got %q", got)
		}
		if got := orgRecord.DefaultContentLocale; got != "ja-JP" {
			t.Fatalf("expected persisted default content locale ja-JP, got %q", got)
		}

		roleReq := connectrpc.NewRequest(&orgv1.UpdateMemberRoleRequest{
			OrgId:    db.DefaultDevOrganizationID,
			MemberId: db.DefaultDevMembershipID,
			RoleId:   editorRoleID,
		})
		roleReq.Header().Set("X-Hualala-Org-Id", db.DefaultDevOrganizationID)
		roleReq.Header().Set("X-Hualala-User-Id", db.DefaultDevUserID)
		roleResp, err := orgClient.UpdateMemberRole(ctx, roleReq)
		if err != nil {
			t.Fatalf("UpdateMemberRole returned error: %v", err)
		}
		if got := roleResp.Msg.GetMember().GetRoleId(); got != editorRoleID {
			t.Fatalf("expected updated role id %q, got %q", editorRoleID, got)
		}

		member, ok := repos.AuthOrg.GetMembership(db.DefaultDevMembershipID)
		if !ok {
			t.Fatalf("expected updated membership to exist")
		}
		if got := member.RoleID; got != editorRoleID {
			t.Fatalf("expected persisted membership role %q, got %q", editorRoleID, got)
		}
	})
}
