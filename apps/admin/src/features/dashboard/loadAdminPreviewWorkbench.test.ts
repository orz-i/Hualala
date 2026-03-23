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
          },
          {
            itemId: "item-2",
            assemblyId: "assembly-project-1",
            shotId: "shot-2",
            primaryAssetId: "asset-2",
            sourceRunId: "run-2",
            sequence: 2,
          },
        ],
      },
    });
    createProjectClientMock.mockReturnValue({
      getPreviewWorkbench: getPreviewWorkbenchMock,
    } as never);

    const result = await loadAdminPreviewWorkbench({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(getPreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result.summary.itemCount).toBe(2);
    expect(result.summary.missingPrimaryAssetCount).toBe(1);
    expect(result.items[1]?.sourceRunId).toBe("run-2");
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
