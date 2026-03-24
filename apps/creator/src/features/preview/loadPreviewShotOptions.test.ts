import { createProjectClient } from "@hualala/sdk";
import { loadPreviewShotOptions } from "./loadPreviewShotOptions";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadPreviewShotOptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes project-scoped preview shot options", async () => {
    const listPreviewShotOptionsMock = vi.fn().mockResolvedValue({
      options: [
        {
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
          shotExecutionId: "shot-exec-1",
          shotExecutionStatus: "ready",
          currentPrimaryAsset: {
            assetId: "asset-1",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: false,
          },
          latestRun: {
            runId: "run-1",
            status: "completed",
            triggerType: "manual",
          },
        },
      ],
    });
    createProjectClientMock.mockReturnValue({
      listPreviewShotOptions: listPreviewShotOptionsMock,
    } as never);

    const result = await loadPreviewShotOptions({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(listPreviewShotOptionsMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result).toEqual([
      expect.objectContaining({
        shotId: "shot-1",
        label: "SCENE-001 / SHOT-001",
        shotSummary: expect.objectContaining({
          shotTitle: "第一镜",
        }),
        currentPrimaryAssetSummary: expect.objectContaining({
          assetId: "asset-1",
        }),
        latestRunSummary: expect.objectContaining({
          runId: "run-1",
        }),
      }),
    ]);
  });

  it("throws when a preview shot option is missing shot metadata", async () => {
    createProjectClientMock.mockReturnValue({
      listPreviewShotOptions: vi.fn().mockResolvedValue({
        options: [{ shotExecutionId: "shot-exec-1" }],
      }),
    } as never);

    await expect(
      loadPreviewShotOptions({
        projectId: "project-1",
      }),
    ).rejects.toThrow("creator: preview shot options payload is incomplete");
  });
});
