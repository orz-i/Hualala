import { describe, expect, it, vi } from "vitest";
import { createSessionBootstrap, isUnauthenticatedSessionError } from "./bootstrap";

describe("session bootstrap helpers", () => {
  it("maps current session with explicit override headers", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      new Response(
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
      ),
    );

    const bootstrap = createSessionBootstrap("admin");
    const session = await bootstrap.loadCurrentSession({
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(session.sessionId).toBe("dev:org-1:user-1");
    expect(session.roleCode).toBe("admin");
    expect(session.permissionCodes).toEqual(["session.read", "org.roles.write"]);
    expect(session.timezone).toBe("Asia/Shanghai");
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "X-Hualala-Org-Id": "org-1",
        "X-Hualala-User-Id": "user-1",
      }),
    });
  });

  it("uses scoped incomplete payload errors", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      new Response(
        JSON.stringify({
          session: {
            orgId: "org-1",
          },
        }),
        { status: 200 },
      ),
    );

    const bootstrap = createSessionBootstrap("creator");

    await expect(
      bootstrap.ensureDevSession({
        baseUrl: "http://127.0.0.1:8080",
        fetchFn,
      }),
    ).rejects.toThrow("creator: auth session payload is incomplete");
  });

  it("recognizes unauthenticated session errors", () => {
    expect(isUnauthenticatedSessionError(new Error("sdk: failed (401)"))).toBe(true);
    expect(isUnauthenticatedSessionError(new Error("unauthenticated: active session not found"))).toBe(true);
    expect(isUnauthenticatedSessionError(new Error("network down"))).toBe(false);
  });
});
