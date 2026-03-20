import { createAssetClient, createExecutionClient } from "@hualala/sdk";
import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "./mutateImportBatchWorkbench";

vi.mock("@hualala/sdk", () => ({
  createAssetClient: vi.fn(),
  createExecutionClient: vi.fn(),
}));

describe("mutateImportBatchWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("confirms import batch items via the sdk asset client", async () => {
    const batchConfirmImportBatchItemsMock = vi.fn().mockResolvedValue({});
    vi.mocked(createAssetClient).mockReturnValue({
      batchConfirmImportBatchItems: batchConfirmImportBatchItemsMock,
    } as never);

    await confirmImportBatchItems({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(batchConfirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
    });
  });

  it("selects primary asset via the sdk execution client", async () => {
    const selectPrimaryAssetMock = vi.fn().mockResolvedValue({});
    vi.mocked(createExecutionClient).mockReturnValue({
      selectPrimaryAsset: selectPrimaryAssetMock,
    } as never);

    await selectPrimaryAssetForImportBatch({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(selectPrimaryAssetMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
    });
  });
});
