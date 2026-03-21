import { describe, expect, it, vi } from "vitest";
import { createUploadClient } from "./client";

describe("createUploadClient", () => {
  it("calls upload session endpoints with identity headers and payloads", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "pending",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "pending",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "pending",
            retry_count: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "upload-session-1",
            status: "uploaded",
            asset_id: "asset-1",
          }),
          { status: 200 },
        ),
      );

    const client = createUploadClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        orgId: "org-1",
        userId: "user-1",
      },
    });

    await client.createSession({
      organization_id: "org-1",
      project_id: "project-1",
      import_batch_id: "batch-1",
      file_name: "scene.png",
      checksum: "sha256:abc",
      size_bytes: 1024,
      expires_in_seconds: 3600,
    });
    await client.getSession("upload-session-1");
    await client.retrySession("upload-session-1");
    await client.completeSession("upload-session-1", {
      shot_execution_id: "shot-exec-1",
      variant_type: "original",
      mime_type: "image/png",
      locale: "zh-CN",
      rights_status: "clear",
      ai_annotated: true,
      width: 1920,
      height: 1080,
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/upload/sessions",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
        body: JSON.stringify({
          organization_id: "org-1",
          project_id: "project-1",
          import_batch_id: "batch-1",
          file_name: "scene.png",
          checksum: "sha256:abc",
          size_bytes: 1024,
          expires_in_seconds: 3600,
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/upload/sessions/upload-session-1",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/upload/sessions/upload-session-1/retry",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/upload/sessions/upload-session-1/complete",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({
          shot_execution_id: "shot-exec-1",
          variant_type: "original",
          mime_type: "image/png",
          locale: "zh-CN",
          rights_status: "clear",
          ai_annotated: true,
          width: 1920,
          height: 1080,
        }),
      }),
    );
  });

  it("throws the response text when an upload request fails", async () => {
    const client = createUploadClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn: vi.fn().mockResolvedValue(
        new Response("upload session expired", { status: 410 }),
      ),
    });

    await expect(client.retrySession("upload-session-1")).rejects.toThrow(
      "upload session expired",
    );
  });

  it("does not inject identity headers when no explicit override is provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "upload-session-1",
          status: "pending",
        }),
        { status: 200 },
      ),
    );

    const client = createUploadClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
    });

    await client.getSession("upload-session-1");

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/upload/sessions/upload-session-1",
      expect.objectContaining({
        credentials: "include",
        headers: expect.not.objectContaining({
          "X-Hualala-Org-Id": expect.anything(),
          "X-Hualala-User-Id": expect.anything(),
        }),
      }),
    );
  });
});
