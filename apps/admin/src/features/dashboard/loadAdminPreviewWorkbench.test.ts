import { createProjectClient } from "@hualala/sdk";
import { loadAdminPreviewWorkbench } from "./loadAdminPreviewWorkbench";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadAdminPreviewWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes preview assembly data for admin observers", async () => {
    const getPreviewWorkbenchMock = vi.fn().mockResolvedValue({
      assembly: {
        assemblyId: "assembly-project-1",
        projectId: "project-1",
        status: "draft",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:05:00.000Z",
        items: [
          {
            itemId: "item-1",
            assemblyId: "assembly-project-1",
            shotId: "shot-1",
            primaryAssetId: "",
            sourceRunId: "",
            sequence: 1,
            shot: {
              projectId: "project-1",
              projectTitle: "项目一",
              episodeId: "episode-1",
              episodeTitle: "第一集",
              sceneId: "scene-1",
              sceneCode: "SCENE-001",
              sceneTitle: "开场",
              shotId: "shot-1",
              shotCode: "SHOT-001",
              shotTitle: "第一镜",
            },
          },
          {
            itemId: "item-2",
            assemblyId: "assembly-project-1",
            shotId: "shot-2",
            primaryAssetId: "asset-2",
            sourceRunId: "run-2",
            sequence: 2,
            shot: {
              projectId: "project-1",
              projectTitle: "项目一",
              episodeId: "episode-1",
              episodeTitle: "第一集",
              sceneId: "scene-1",
              sceneCode: "SCENE-001",
              sceneTitle: "开场",
              shotId: "shot-2",
              shotCode: "SHOT-002",
              shotTitle: "第二镜",
            },
            primaryAsset: {
              assetId: "asset-2",
              mediaType: "image",
              rightsStatus: "cleared",
              aiAnnotated: true,
            },
            sourceRun: {
              runId: "run-2",
              status: "completed",
              triggerType: "manual",
            },
          },
        ],
      },
    });
    createProjectClientMock.mockReturnValue({
      getPreviewWorkbench: getPreviewWorkbenchMock,
    } as never);

    const result = await loadAdminPreviewWorkbench({
      projectId: "project-1",
      displayLocale: "en-US",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(getPreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
      displayLocale: "en-US",
    });
    expect(result.summary.itemCount).toBe(2);
    expect(result.summary.missingPrimaryAssetCount).toBe(1);
    expect(result.summary.missingSourceRunCount).toBe(1);
    expect(result.items[0]?.shotSummary?.shotTitle).toBe("第一镜");
    expect(result.items[1]?.primaryAssetSummary?.mediaType).toBe("image");
    expect(result.items[1]?.sourceRunSummary?.triggerType).toBe("manual");
  });

  it("throws when the admin preview payload is incomplete", async () => {
    createProjectClientMock.mockReturnValue({
      getPreviewWorkbench: vi.fn().mockResolvedValue({
        assembly: {
          assemblyId: "",
          projectId: "",
          items: [],
        },
      }),
    } as never);

    await expect(
      loadAdminPreviewWorkbench({
        projectId: "project-1",
      }),
    ).rejects.toThrow("admin: preview workbench payload is incomplete");
  });
});
