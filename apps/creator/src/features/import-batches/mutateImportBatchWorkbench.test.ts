import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "./mutateImportBatchWorkbench";

describe("mutateImportBatchWorkbench", () => {
  it("posts BatchConfirmImportBatchItems to the real connect endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });

    await confirmImportBatchItems({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          importBatchId: "batch-1",
          itemIds: ["item-1"],
        }),
      }),
    );
  });

  it("posts SelectPrimaryAsset to the real connect endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });

    await selectPrimaryAssetForImportBatch({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.execution.v1.ExecutionService/SelectPrimaryAsset",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
          assetId: "asset-1",
        }),
      }),
    );
  });
});
