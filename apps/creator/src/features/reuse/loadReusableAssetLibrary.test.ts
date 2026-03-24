import { describe, expect, it, vi } from "vitest";
import { loadReusableAssetLibrary } from "./loadReusableAssetLibrary";

describe("loadReusableAssetLibrary", () => {
  it("loads external-project assets and marks only clear non-AI assets as reusable", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatches: [{ id: "batch-source-1" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatch: {
              id: "batch-source-1",
              projectId: "project-source-9",
              sourceType: "upload_session",
            },
            uploadFiles: [
              {
                id: "upload-external-1",
                fileName: "hero-shot.png",
                mimeType: "image/png",
              },
            ],
            mediaAssets: [
              {
                id: "asset-external-clear",
                projectId: "project-source-9",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-source-1",
                locale: "zh-CN",
                aiAnnotated: false,
                mediaType: "image",
              },
              {
                id: "asset-external-ai",
                projectId: "project-source-9",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-source-1",
                locale: "zh-CN",
                aiAnnotated: true,
                mediaType: "image",
              },
              {
                id: "asset-external-restricted",
                projectId: "project-source-9",
                sourceType: "upload_session",
                rightsStatus: "restricted",
                importBatchId: "batch-source-1",
                locale: "zh-CN",
                aiAnnotated: false,
                mediaType: "image",
              },
              {
                id: "asset-same-project",
                projectId: "project-live-1",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-source-1",
                locale: "zh-CN",
                aiAnnotated: false,
                mediaType: "image",
              },
            ],
            mediaAssetVariants: [
              {
                id: "variant-external-1",
                assetId: "asset-external-clear",
                uploadFileId: "upload-external-1",
                variantType: "master",
                mimeType: "image/png",
              },
            ],
            candidateAssets: [
              {
                assetId: "asset-external-clear",
                sourceRunId: "run-external-1",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const items = await loadReusableAssetLibrary({
      currentProjectId: "project-live-1",
      sourceProjectId: "project-source-9",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(items).toEqual([
      expect.objectContaining({
        assetId: "asset-external-ai",
        sourceProjectId: "project-source-9",
        allowed: false,
        blockedReason: "creator: consent status is unavailable for ai_annotated assets",
      }),
      expect.objectContaining({
        assetId: "asset-external-clear",
        sourceProjectId: "project-source-9",
        fileName: "hero-shot.png",
        sourceRunId: "run-external-1",
        allowed: true,
        blockedReason: "",
      }),
      expect.objectContaining({
        assetId: "asset-external-restricted",
        sourceProjectId: "project-source-9",
        allowed: false,
        blockedReason: "creator: rights status does not allow cross-project reuse",
      }),
    ]);
  });
});
