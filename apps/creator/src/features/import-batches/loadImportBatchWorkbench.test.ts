import { createAssetClient } from "@hualala/sdk";
import { loadImportBatchWorkbench } from "./loadImportBatchWorkbench";

vi.mock("@hualala/sdk", () => ({
  createAssetClient: vi.fn(),
}));

describe("loadImportBatchWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the import workbench via the sdk asset client", async () => {
    const getImportBatchWorkbenchMock = vi.fn().mockResolvedValue({
      importBatch: {
        id: "batch-1",
        orgId: "org-1",
        projectId: "project-1",
        status: "matched_pending_confirm",
        sourceType: "upload_session",
      },
      uploadSessions: [
        {
          id: "upload-session-1",
          status: "completed",
          fileName: "scene.png",
          checksum: "sha256:abc",
          sizeBytes: 1024,
          retryCount: 2,
          resumeHint: "upload complete for scene.png",
        },
      ],
      items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
      candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
      shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
    });
    vi.mocked(createAssetClient).mockReturnValue({
      getImportBatchWorkbench: getImportBatchWorkbenchMock,
    } as never);

    const result = await loadImportBatchWorkbench({
      importBatchId: "batch-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createAssetClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
      }),
    );
    expect(getImportBatchWorkbenchMock).toHaveBeenCalledWith({
      importBatchId: "batch-1",
    });
    expect(result.importBatch.id).toBe("batch-1");
    expect(result.importBatch.orgId).toBe("org-1");
    expect(result.importBatch.projectId).toBe("project-1");
    expect(result.uploadSessions).toHaveLength(1);
    expect(result.uploadSessions[0]).toMatchObject({
      fileName: "scene.png",
      checksum: "sha256:abc",
      sizeBytes: 1024,
      retryCount: 2,
      resumeHint: "upload complete for scene.png",
    });
    expect(result.candidateAssets).toHaveLength(1);
    expect(result.shotExecutions[0]?.status).toBe("candidate_ready");
  });
});
