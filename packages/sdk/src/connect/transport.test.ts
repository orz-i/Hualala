import { describe, expect, it } from "vitest";
import {
  createHualalaClient,
  resolveConnectBaseUrl,
  trimTrailingSlash,
} from "./transport";

describe("sdk transport", () => {
  it("normalizes explicit base urls", () => {
    expect(trimTrailingSlash("http://localhost:8080/")).toBe("http://localhost:8080");
    expect(resolveConnectBaseUrl("http://localhost:8080/")).toBe("http://localhost:8080");
  });

  it("uses window origin when explicit base url is omitted", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test window shim
    globalThis.window = { location: { origin: "http://127.0.0.1:4173/" } };
    try {
      expect(resolveConnectBaseUrl()).toBe("http://127.0.0.1:4173");
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("posts connect json through the shared client", async () => {
    const fetchFn = async () =>
      new Response(
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

    const client = createHualalaClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const result = await client.unary<{
      session?: { sessionId?: string };
    }>("/hualala.auth.v1.AuthService/GetCurrentSession", {});
    expect(result.session?.sessionId).toBe("dev:org-1:user-1");
  });
});
