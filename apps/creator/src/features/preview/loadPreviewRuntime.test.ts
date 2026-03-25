import { createProjectClient } from "@hualala/sdk";
import { loadPreviewRuntime } from "./loadPreviewRuntime";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadPreviewRuntime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes preview runtime data for creator", async () => {
    const getPreviewRuntimeMock = vi.fn().mockResolvedValue({
      runtime: {
        previewRuntimeId: "runtime-project-1",
        projectId: "project-1",
        episodeId: "",
        assemblyId: "assembly-project-1",
        status: "idle",
        renderWorkflowRunId: "workflow-preview-1",
        renderStatus: "queued",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
        resolvedLocale: "en-US",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:05:00.000Z",
        playback: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/preview-runtime-1.mp4",
          posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
          durationMs: 30000,
        },
        exportOutput: {
          downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
          mimeType: "video/mp4",
          fileName: "preview-export-1.mp4",
          sizeBytes: 4096,
        },
        lastErrorCode: "",
        lastErrorMessage: "",
      },
    });
    createProjectClientMock.mockReturnValue({
      getPreviewRuntime: getPreviewRuntimeMock,
    } as never);

    const result = await loadPreviewRuntime({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createProjectClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: "org-1",
          userId: "user-1",
        },
      }),
    );
    expect(getPreviewRuntimeMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        previewRuntimeId: "runtime-project-1",
        renderStatus: "queued",
        resolvedLocale: "en-US",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
        playback: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/preview-runtime-1.mp4",
          posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
          durationMs: 30000,
        },
        exportOutput: {
          downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
          mimeType: "video/mp4",
          fileName: "preview-export-1.mp4",
          sizeBytes: 4096,
        },
      }),
    );
  });

  it("throws when the preview runtime payload is incomplete", async () => {
    createProjectClientMock.mockReturnValue({
      getPreviewRuntime: vi.fn().mockResolvedValue({
        runtime: {
          previewRuntimeId: "",
          projectId: "",
        },
      }),
    } as never);

    await expect(
      loadPreviewRuntime({
        projectId: "project-1",
      }),
    ).rejects.toThrow("creator: preview runtime payload is incomplete");
  });
});
