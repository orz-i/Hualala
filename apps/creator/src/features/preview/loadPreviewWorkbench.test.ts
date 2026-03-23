import { createProjectClient } from "@hualala/sdk";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadPreviewWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes a project preview assembly", async () => {
    const getPreviewWorkbenchMock = vi.fn().mockResolvedValue({
      assembly: {
        assemblyId: "assembly-project-1",
        projectId: "project-1",
        episodeId: "",
        status: "draft",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:05:00.000Z",
        items: [
          {
            itemId: "item-2",
            assemblyId: "assembly-project-1",
            shotId: "shot-2",
            primaryAssetId: "asset-2",
            sourceRunId: "run-2",
            sequence: 2,
          },
          {
            itemId: "item-1",
            assemblyId: "assembly-project-1",
            shotId: "shot-1",
            primaryAssetId: "",
            sourceRunId: "",
            sequence: 1,
          },
        ],
      },
    });
    createProjectClientMock.mockReturnValue({
      getPreviewWorkbench: getPreviewWorkbenchMock,
    } as never);

    const result = await loadPreviewWorkbench({
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
    expect(getPreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result.assembly.assemblyId).toBe("assembly-project-1");
    expect(result.items.map((item) => item.shotId)).toEqual(["shot-1", "shot-2"]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        itemId: "item-1",
        sequence: 1,
      }),
    );
  });

  it("throws when the preview payload is incomplete", async () => {
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
      loadPreviewWorkbench({
        projectId: "project-1",
      }),
    ).rejects.toThrow("creator: preview workbench payload is incomplete");
  });
});
