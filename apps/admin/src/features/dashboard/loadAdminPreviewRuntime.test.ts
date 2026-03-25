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
        renderStatus: "succeeded",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
        resolvedLocale: "zh-CN",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:06:00.000Z",
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
        renderStatus: "succeeded",
        resolvedLocale: "zh-CN",
        playbackAssetId: "asset-playback-1",
        exportAssetId: "asset-export-1",
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
