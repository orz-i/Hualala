import { createProjectClient } from "@hualala/sdk";
import { loadAdminPreviewRuntime } from "./loadAdminPreviewRuntime";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadAdminPreviewRuntime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes preview runtime data for admin", async () => {
    const getPreviewRuntimeMock = vi.fn().mockResolvedValue({
      runtime: {
        previewRuntimeId: "runtime-project-1",
        projectId: "project-1",
        episodeId: "",
        assemblyId: "assembly-project-1",
        status: "ready",
        renderWorkflowRunId: "workflow-preview-1",
        renderStatus: "completed",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
        resolvedLocale: "zh-CN",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:06:00.000Z",
        playback: {
          deliveryMode: "manifest",
          playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
          posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
          durationMs: 30000,
          timeline: {
            totalDurationMs: 30000,
            segments: [
              {
                segmentId: "segment-1",
                sequence: 1,
                shotId: "shot-1",
                shotCode: "SHOT-001",
                shotTitle: "第一镜",
                playbackAssetId: "asset-playback-segment-1",
                sourceRunId: "run-segment-1",
                startMs: 0,
                durationMs: 12000,
                transitionToNext: {
                  transitionType: "crossfade",
                  durationMs: 300,
                },
              },
              {
                segmentId: "segment-2",
                sequence: 2,
                shotId: "shot-2",
                shotCode: "SHOT-002",
                shotTitle: "第二镜",
                playbackAssetId: "asset-playback-segment-2",
                sourceRunId: "run-segment-2",
                startMs: 12000,
                durationMs: 18000,
                transitionToNext: null,
              },
            ],
          },
        },
        exportOutput: {
          downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
          mimeType: "video/mp4",
          fileName: "preview-export-1.mp4",
          sizeBytes: 8192,
        },
        lastErrorCode: "preview_runtime_ready_with_warning",
        lastErrorMessage: "stale poster fallback",
      },
    });
    createProjectClientMock.mockReturnValue({
      getPreviewRuntime: getPreviewRuntimeMock,
    } as never);

    const result = await loadAdminPreviewRuntime({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(getPreviewRuntimeMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        previewRuntimeId: "runtime-project-1",
        renderStatus: "completed",
        resolvedLocale: "zh-CN",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
        playback: {
          deliveryMode: "manifest",
          playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
          posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
          durationMs: 30000,
          timeline: {
            totalDurationMs: 30000,
            segments: [
              {
                segmentId: "segment-1",
                sequence: 1,
                shotId: "shot-1",
                shotCode: "SHOT-001",
                shotTitle: "第一镜",
                playbackAssetId: "asset-playback-segment-1",
                sourceRunId: "run-segment-1",
                startMs: 0,
                durationMs: 12000,
                transitionToNext: {
                  transitionType: "crossfade",
                  durationMs: 300,
                },
              },
              {
                segmentId: "segment-2",
                sequence: 2,
                shotId: "shot-2",
                shotCode: "SHOT-002",
                shotTitle: "第二镜",
                playbackAssetId: "asset-playback-segment-2",
                sourceRunId: "run-segment-2",
                startMs: 12000,
                durationMs: 18000,
                transitionToNext: null,
              },
            ],
          },
        },
        exportOutput: {
          downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
          mimeType: "video/mp4",
          fileName: "preview-export-1.mp4",
          sizeBytes: 8192,
        },
        lastErrorCode: "preview_runtime_ready_with_warning",
        lastErrorMessage: "stale poster fallback",
      }),
    );
  });

  it("throws when the admin preview runtime payload is incomplete", async () => {
    createProjectClientMock.mockReturnValue({
      getPreviewRuntime: vi.fn().mockResolvedValue({
        runtime: {
          previewRuntimeId: "",
          projectId: "",
        },
      }),
    } as never);

    await expect(
      loadAdminPreviewRuntime({
        projectId: "project-1",
      }),
    ).rejects.toThrow("admin: preview runtime payload is incomplete");
  });
});
