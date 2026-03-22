import { createAssetClient } from "@hualala/sdk";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";

vi.mock("@hualala/sdk", () => ({
  createAssetClient: vi.fn(),
}));

describe("loadAssetProvenanceDetails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads provenance details via the sdk asset client", async () => {
    const getAssetProvenanceSummaryMock = vi.fn().mockResolvedValue({
      asset: {
        id: "asset-1",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary:
        "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
      candidateAssetId: "candidate-1",
      shotExecutionId: "shot-exec-1",
      sourceRunId: "source-run-1",
      importBatchId: "batch-1",
      variantCount: 2,
    });
    vi.mocked(createAssetClient).mockReturnValue({
      getAssetProvenanceSummary: getAssetProvenanceSummaryMock,
    } as never);

    const result = await loadAssetProvenanceDetails({
      assetId: "asset-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createAssetClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: "org-1",
          userId: "user-1",
        },
      }),
    );
    expect(getAssetProvenanceSummaryMock).toHaveBeenCalledWith({
      assetId: "asset-1",
    });
    expect(result).toEqual({
      asset: {
        id: "asset-1",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary:
        "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
      candidateAssetId: "candidate-1",
      shotExecutionId: "shot-exec-1",
      sourceRunId: "source-run-1",
      importBatchId: "batch-1",
      variantCount: 2,
    });
  });

  it("throws when the provenance payload is incomplete", async () => {
    vi.mocked(createAssetClient).mockReturnValue({
      getAssetProvenanceSummary: vi.fn().mockResolvedValue({
        asset: {
          projectId: "project-1",
        },
      }),
    } as never);

    await expect(
      loadAssetProvenanceDetails({
        assetId: "asset-incomplete",
        fetchFn: vi.fn(),
      }),
    ).rejects.toThrow("creator: asset provenance payload is incomplete");
  });

  it("falls back missing string fields and booleans to creator defaults", async () => {
    vi.mocked(createAssetClient).mockReturnValue({
      getAssetProvenanceSummary: vi.fn().mockResolvedValue({
        asset: {
          id: "asset-2",
        },
      }),
    } as never);

    const result = await loadAssetProvenanceDetails({
      assetId: "asset-2",
      fetchFn: vi.fn(),
    });

    expect(result).toEqual({
      asset: {
        id: "asset-2",
        projectId: "",
        sourceType: "unknown",
        rightsStatus: "unknown",
        importBatchId: "",
        locale: "",
        aiAnnotated: false,
      },
      provenanceSummary: "",
      candidateAssetId: "",
      shotExecutionId: "",
      sourceRunId: "",
      importBatchId: "",
      variantCount: 0,
    });
  });
});
