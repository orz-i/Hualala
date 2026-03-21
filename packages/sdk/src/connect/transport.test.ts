import { describe, expect, it, vi } from "vitest";
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
    const fetchFn = vi.fn(async () =>
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
      ));

    const client = createHualalaClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const result = await client.unary<{
      session?: { sessionId?: string };
    }>("/hualala.auth.v1.AuthService/GetCurrentSession", {});
    expect(result.session?.sessionId).toBe("dev:org-1:user-1");
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.auth.v1.AuthService/GetCurrentSession",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
      }),
    );
  });

  it("uses include credentials and does not inject identity headers by default", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = createHualalaClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
    });

    await client.unary<{ ok: boolean }>("/hualala.auth.v1.AuthService/GetCurrentSession", {});

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.auth.v1.AuthService/GetCurrentSession",
      expect.objectContaining({
        credentials: "include",
        headers: expect.not.objectContaining({
          "X-Hualala-Org-Id": expect.anything(),
          "X-Hualala-User-Id": expect.anything(),
        }),
      }),
    );
  });

  it("returns an empty object for successful unary calls with an empty body", async () => {
    const client = createHualalaClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn: async () => new Response(null, { status: 200 }),
    });

    const result = await client.unary<Record<string, never>>(
      "/hualala.execution.v1.ExecutionService/SubmitShotForReview",
      { shotExecutionId: "shot-exec-1" },
    );

    expect(result).toEqual({});
  });

  it("exposes upload session helpers through the shared client", async () => {
    const fetchFn = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/upload/sessions")) {
        return new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "pending",
            retry_count: 0,
            resume_hint: "upload scene.png from byte 0",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/upload/sessions/upload-session-1")) {
        return new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "expired",
            retry_count: 0,
            resume_hint: "create a retry session",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/upload/sessions/upload-session-1/retry")) {
        return new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "pending",
            retry_count: 1,
            resume_hint: "retry from byte 0",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/upload/sessions/upload-session-1/complete")) {
        return new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "uploaded",
            asset_id: "asset-1",
          }),
          { status: 200 },
        );
      }
      return new Response(`unexpected request ${url}`, { status: 500 });
    };

    const client = createHualalaClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const uploadClient = (client as typeof client & {
      upload?: {
        createSession?: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
        getSession?: (sessionId: string) => Promise<Record<string, unknown>>;
        retrySession?: (sessionId: string) => Promise<Record<string, unknown>>;
        completeSession?: (
          sessionId: string,
          body: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      };
    }).upload;

    expect(uploadClient).toBeDefined();
    expect(uploadClient?.createSession).toBeTypeOf("function");
    expect(uploadClient?.getSession).toBeTypeOf("function");
    expect(uploadClient?.retrySession).toBeTypeOf("function");
    expect(uploadClient?.completeSession).toBeTypeOf("function");

    const created = await uploadClient!.createSession!({
      organization_id: "org-1",
      project_id: "project-1",
      import_batch_id: "batch-1",
      file_name: "scene.png",
      checksum: "sha256:abc",
      size_bytes: 1024,
      expires_in_seconds: 3600,
    });
    const current = await uploadClient!.getSession!("upload-session-1");
    const retried = await uploadClient!.retrySession!("upload-session-1");
    const completed = await uploadClient!.completeSession!("upload-session-1", {
      shot_execution_id: "",
      variant_type: "original",
      mime_type: "image/png",
      locale: "zh-CN",
      rights_status: "clear",
      ai_annotated: true,
      width: 1920,
      height: 1080,
    });

    expect(created.session_id).toBe("upload-session-1");
    expect(current.status).toBe("expired");
    expect(retried.retry_count).toBe(1);
    expect(completed.asset_id).toBe("asset-1");
  });
});
