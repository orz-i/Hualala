import { describe, expect, it, vi } from "vitest";
import { loadAudioAssetPool } from "./loadAudioAssetPool";

describe("loadAudioAssetPool", () => {
  it("collects only audio assets with a usable duration from project import batches", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatches: [
              {
                id: "batch-1",
                orgId: "org-1",
                projectId: "project-1",
                operatorId: "user-1",
                sourceType: "upload_session",
                status: "confirmed",
                uploadSessionCount: 1,
                itemCount: 2,
                confirmedItemCount: 2,
                candidateAssetCount: 2,
                mediaAssetCount: 3,
                updatedAt: "2026-03-24T08:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatch: {
              id: "batch-1",
              orgId: "org-1",
              projectId: "project-1",
              sourceType: "upload_session",
              status: "confirmed",
            },
            uploadFiles: [
              {
                id: "upload-file-1",
                uploadSessionId: "upload-session-1",
                fileName: "dialogue.wav",
                mimeType: "audio/wav",
                checksum: "sha256:dialogue",
                sizeBytes: 1024,
              },
              {
                id: "upload-file-2",
                uploadSessionId: "upload-session-1",
                fileName: "poster.png",
                mimeType: "image/png",
                checksum: "sha256:poster",
                sizeBytes: 512,
              },
            ],
            mediaAssets: [
              {
                id: "asset-audio-1",
                projectId: "project-1",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-1",
                locale: "zh-CN",
                aiAnnotated: true,
                mediaType: "audio",
              },
              {
                id: "asset-image-1",
                projectId: "project-1",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-1",
                locale: "zh-CN",
                aiAnnotated: true,
                mediaType: "image",
              },
              {
                id: "asset-audio-2",
                projectId: "project-1",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "batch-1",
                locale: "zh-CN",
                aiAnnotated: true,
                mediaType: "audio",
              },
            ],
            mediaAssetVariants: [
              {
                id: "variant-audio-1",
                assetId: "asset-audio-1",
                uploadFileId: "upload-file-1",
                variantType: "master",
                mimeType: "audio/wav",
                width: 0,
                height: 0,
                durationMs: 12000,
              },
              {
                id: "variant-image-1",
                assetId: "asset-image-1",
                uploadFileId: "upload-file-2",
                variantType: "master",
                mimeType: "image/png",
                width: 1280,
                height: 720,
                durationMs: 0,
              },
              {
                id: "variant-audio-2",
                assetId: "asset-audio-2",
                uploadFileId: "upload-file-1",
                variantType: "master",
                mimeType: "audio/wav",
                width: 0,
                height: 0,
                durationMs: 0,
              },
            ],
            candidateAssets: [
              {
                id: "candidate-audio-1",
                assetId: "asset-audio-1",
                shotExecutionId: "shot-exec-1",
                sourceRunId: "run-audio-1",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const items = await loadAudioAssetPool({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(items).toEqual([
      {
        assetId: "asset-audio-1",
        importBatchId: "batch-1",
        durationMs: 12000,
        sourceRunId: "run-audio-1",
        fileName: "dialogue.wav",
        mediaType: "audio",
        sourceType: "upload_session",
        rightsStatus: "clear",
        locale: "zh-CN",
        variantId: "variant-audio-1",
        variantType: "master",
        mimeType: "audio/wav",
      },
    ]);
  });
});
