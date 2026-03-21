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
      return new Response(
        JSON.stringify({
          roles: [{ roleId: "role-1", orgId: "org-1", code: "admin", displayName: "Administrator" }],
        }),
        { status: 200 },
      );
    });

    const client = createAuthOrgClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const [session, members, roles] = await Promise.all([
      client.getCurrentSession(),
      client.listMembers({ orgId: "org-1" }),
      client.listRoles({ orgId: "org-1" }),
    ]);

    expect(session.session?.sessionId).toBe("dev:org-1:user-1");
    expect(members.members[0]?.memberId).toBe("member-1");
    expect(roles.roles[0]?.roleId).toBe("role-1");
    expect(fetchFn).toHaveBeenCalledTimes(3);
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
});
