import { describe, expect, it, vi } from "vitest";
import { createAuthOrgClient } from "./authOrg";

describe("auth/org sdk client", () => {
  it("loads governance payloads using shared transport and dev headers", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.auth.v1.AuthService/GetCurrentSession")) {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: "dev:org-1:user-1",
              orgId: "org-1",
              userId: "user-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: ["session.read", "org.roles.write"],
              timezone: "Asia/Shanghai",
            },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.org.v1.OrgService/ListMembers")) {
        return new Response(
          JSON.stringify({
            members: [{ memberId: "member-1", orgId: "org-1", userId: "user-1", roleId: "role-1" }],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.org.v1.OrgService/GetOrgLocaleSettings")) {
        return new Response(
          JSON.stringify({
            localeSettings: {
              orgId: "org-1",
              defaultLocale: "zh-CN",
              supportedLocales: ["zh-CN"],
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
              roleId: "role-1",
              orgId: "org-1",
              code: "admin",
              displayName: "Administrator",
              permissionCodes: ["session.read", "org.roles.write"],
            },
          ],
        }),
        { status: 200 },
      );
    });

    const client = createAuthOrgClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const [session, members, roles, localeSettings, permissions] = await Promise.all([
      client.getCurrentSession(),
      client.listMembers({ orgId: "org-1" }),
      client.listRoles({ orgId: "org-1" }),
      client.getOrgLocaleSettings({ orgId: "org-1" }),
      client.listAvailablePermissions({ orgId: "org-1" }),
    ]);

    expect(session.session?.sessionId).toBe("dev:org-1:user-1");
    expect(session.session?.roleCode).toBe("admin");
    expect(session.session?.timezone).toBe("Asia/Shanghai");
    expect(members.members[0]?.memberId).toBe("member-1");
    expect(roles.roles[0]?.roleId).toBe("role-1");
    expect(roles.roles[0]?.permissionCodes).toEqual(["session.read", "org.roles.write"]);
    expect(localeSettings.localeSettings?.defaultLocale).toBe("zh-CN");
    expect(permissions.permissions[0]?.code).toBe("org.roles.write");
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(fetchFn.mock.calls[0]?.[1] ?? {}).toMatchObject({
      headers: expect.objectContaining({
        "X-Hualala-Org-Id": "org-1",
        "X-Hualala-User-Id": "user-1",
      }),
    });
  });

  it("starts clears and refreshes dev session through auth service routes", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.auth.v1.AuthService/StartDevSession")) {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: "dev:org-1:user-1",
              orgId: "org-1",
              userId: "user-1",
              locale: "zh-CN",
              roleId: "role-1",
              roleCode: "admin",
              permissionCodes: ["session.read", "org.roles.write"],
              timezone: "Asia/Shanghai",
            },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.auth.v1.AuthService/ClearCurrentSession")) {
        return new Response(null, { status: 200 });
      }
      return new Response(
        JSON.stringify({
          session: {
            sessionId: "dev:org-1:user-1",
            orgId: "org-1",
            userId: "user-1",
            locale: "zh-CN",
            roleId: "role-1",
            roleCode: "admin",
            permissionCodes: ["session.read", "org.roles.write"],
            timezone: "Asia/Shanghai",
          },
        }),
        { status: 200 },
      );
    });

    const client = createAuthOrgClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    const start = await client.startDevSession();
    const refresh = await client.refreshSession();
    const cleared = await client.clearCurrentSession();

    expect(start.session?.sessionId).toBe("dev:org-1:user-1");
    expect(refresh.session?.sessionId).toBe("dev:org-1:user-1");
    expect(cleared).toEqual({});
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/hualala.auth.v1.AuthService/RefreshSession",
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: "dev-refresh" }),
      }),
    );
  });

  it("creates updates and deletes roles through org service routes", async () => {
    const fetchFn = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            role: {
              roleId: "role-editor",
              orgId: "org-1",
              code: "editor",
              displayName: "Editor",
              permissionCodes: ["session.read", "org.roles.read"],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            role: {
              roleId: "role-editor",
              orgId: "org-1",
              code: "editor",
              displayName: "Content Editor",
              permissionCodes: ["session.read"],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = createAuthOrgClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const created = await client.createRole({
      orgId: "org-1",
      code: "editor",
      displayName: "Editor",
      permissionCodes: ["session.read", "org.roles.read"],
    });
    const updated = await client.updateRole({
      orgId: "org-1",
      roleId: "role-editor",
      displayName: "Content Editor",
      permissionCodes: ["session.read"],
    });
    const deleted = await client.deleteRole({
      orgId: "org-1",
      roleId: "role-editor",
    });

    expect(created.role?.displayName).toBe("Editor");
    expect(updated.role?.displayName).toBe("Content Editor");
    expect(deleted).toEqual({});
  });
});
