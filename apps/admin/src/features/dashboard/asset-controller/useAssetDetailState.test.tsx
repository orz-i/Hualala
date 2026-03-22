import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createAssetBatchDetail,
  createAssetProvenanceDetail,
} from "../assetMonitor.test-data";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "../loadImportBatchDetails";
import { useAssetDetailState } from "./useAssetDetailState";

vi.mock("../loadImportBatchDetails", () => ({
  loadImportBatchDetails: vi.fn(),
}));
vi.mock("../loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

const loadImportBatchDetailsMock = vi.mocked(loadImportBatchDetails);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);

describe("useAssetDetailState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens batch and provenance details, clears provenance when a batch is selected, and clears everything when the batch closes", async () => {
    loadImportBatchDetailsMock.mockResolvedValue(createAssetBatchDetail("project-live-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("project-live-001"),
    );

    const { result } = renderHook(() =>
      useAssetDetailState({
        sessionState: "ready",
        identityOverride: undefined,
      }),
    );

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    act(() => {
      result.current.onToggleImportBatchItemSelection({ itemId: "import-item-1", checked: true });
      result.current.onSelectAssetProvenance("media-asset-1");
    });

    await waitFor(() => {
      expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-2");
    });

    await waitFor(() => {
      expect(result.current.assetProvenanceDetail).toBeNull();
    });

    expect(result.current.selectedImportItemIds).toEqual([]);

    act(() => {
      result.current.onCloseImportBatchDetail();
    });

    expect(result.current.importBatchDetail).toBeNull();
    expect(result.current.assetProvenanceDetail).toBeNull();
    expect(result.current.selectedImportItemIds).toEqual([]);
  });

  it("keeps the existing state when detail or provenance refresh fails", async () => {
    loadImportBatchDetailsMock.mockResolvedValueOnce(createAssetBatchDetail("project-live-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValueOnce(
      createAssetProvenanceDetail("project-live-001"),
    );

    const { result } = renderHook(() =>
      useAssetDetailState({
        sessionState: "ready",
        identityOverride: {
          orgId: "org-demo-001",
          userId: "user-demo-001",
        },
      }),
    );

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    act(() => {
      result.current.onSelectAssetProvenance("media-asset-1");
    });

    await waitFor(() => {
      expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
    });

    loadImportBatchDetailsMock.mockRejectedValueOnce(new Error("detail exploded"));
    loadAssetProvenanceDetailsMock.mockRejectedValueOnce(new Error("provenance exploded"));

    await act(async () => {
      await result.current.refreshImportBatchDetail("import-batch-1");
      await result.current.refreshAssetProvenanceDetail("media-asset-1");
    });

    expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
  });
});
