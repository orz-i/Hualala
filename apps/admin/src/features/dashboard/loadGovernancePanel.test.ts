import { loadGovernancePanel } from "./loadGovernancePanel";

describe("loadGovernancePanel", () => {
  it("merges current session, members, and roles into one governance view model", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.auth.v1.AuthService/GetCurrentSession")) {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: "dev:org-live-1:user-live-1",
              orgId: "org-live-1",
              userId: "user-live-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: [
                "session.read",
                "user.preferences.write",
                "org.members.read",
                "org.roles.read",
                "org.members.write",
                "org.settings.write",
                "org.roles.write",
              ],
              timezone: "Asia/Shanghai",
            },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.org.v1.OrgService/ListMembers")) {
        return new Response(
          JSON.stringify({
            members: [{ memberId: "member-1", orgId: "org-live-1", userId: "user-live-1", roleId: "role-admin" }],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.org.v1.OrgService/GetOrgLocaleSettings")) {
        return new Response(
          JSON.stringify({
            localeSettings: {
              orgId: "org-live-1",
              defaultLocale: "zh-CN",
              supportedLocales: ["zh-CN", "en-US"],
            },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.org.v1.OrgService/ListAvailablePermissions")) {
        return new Response(
          JSON.stringify({
            permissions: [
              {
                code: "org.roles.write",
                displayName: "Manage roles",
                group: "governance",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          roles: [
            {
              roleId: "role-admin",
              orgId: "org-live-1",
              code: "admin",
              displayName: "Administrator",
              permissionCodes: [
                "session.read",
                "user.preferences.write",
                "org.members.read",
                "org.roles.read",
                "org.members.write",
                "org.settings.write",
                "org.roles.write",
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await loadGovernancePanel({
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.currentSession.sessionId).toBe("dev:org-live-1:user-live-1");
    expect(result.currentSession.roleCode).toBe("admin");
    expect(result.currentSession.permissionCodes).toContain("org.roles.write");
    expect(result.members[0]?.memberId).toBe("member-1");
    expect(result.roles[0]?.displayName).toBe("Administrator");
    expect(result.userPreferences.timezone).toBe("Asia/Shanghai");
    expect(result.orgLocaleSettings.supportedLocales).toEqual(["zh-CN", "en-US"]);
    expect(result.availablePermissions[0]?.code).toBe("org.roles.write");
    expect(result.capabilities.canManageRoles).toBe(true);
  });
});
