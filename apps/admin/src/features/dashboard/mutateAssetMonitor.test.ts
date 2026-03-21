import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "./mutateAssetMonitor";

const batchConfirmImportBatchItemsMock = vi.fn();
const selectPrimaryAssetMock = vi.fn();

vi.mock("@hualala/sdk", () => ({
  createAssetClient: vi.fn(() => ({
    batchConfirmImportBatchItems: batchConfirmImportBatchItemsMock,
  })),
  createExecutionClient: vi.fn(() => ({
    selectPrimaryAsset: selectPrimaryAssetMock,
  })),
}));

describe("mutateAssetMonitor", () => {
  beforeEach(() => {
    batchConfirmImportBatchItemsMock.mockReset();
    selectPrimaryAssetMock.mockReset();
    batchConfirmImportBatchItemsMock.mockResolvedValue({});
    selectPrimaryAssetMock.mockResolvedValue({});
  });

  it("confirms a single import batch item as a single-element array", async () => {
    await confirmImportBatchItem({
      importBatchId: "import-batch-1",
      itemId: "item-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(batchConfirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["item-1"],
    });
  });

  it("confirms multiple import batch items without rewriting the array", async () => {
    await confirmImportBatchItems({
      importBatchId: "import-batch-1",
      itemIds: ["item-1", "item-2"],
      orgId: "org-1",
      userId: "user-1",
    });

    expect(batchConfirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["item-1", "item-2"],
    });
  });

  it("selects the primary asset through the execution client", async () => {
    await selectPrimaryAssetForImportBatch({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(selectPrimaryAssetMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
    });
  });
});
