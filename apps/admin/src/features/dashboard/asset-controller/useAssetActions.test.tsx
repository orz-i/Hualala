import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../mutateAssetMonitor";
import { useAssetActions } from "./useAssetActions";

vi.mock("../mutateAssetMonitor", async () => {
  const actual = await vi.importActual<typeof import("../mutateAssetMonitor")>(
    "../mutateAssetMonitor",
  );
  return {
    ...actual,
    confirmImportBatchItem: vi.fn(),
    confirmImportBatchItems: vi.fn(),
    selectPrimaryAssetForImportBatch: vi.fn(),
  };
});
vi.mock("../waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const confirmImportBatchItemMock = vi.mocked(confirmImportBatchItem);
const confirmImportBatchItemsMock = vi.mocked(confirmImportBatchItems);
const selectPrimaryAssetForImportBatchMock = vi.mocked(selectPrimaryAssetForImportBatch);

describe("useAssetActions", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears selection after confirm-selected succeeds", async () => {
    const refreshAssetSilently = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const clearSelectedImportItemIds = vi.fn();
    confirmImportBatchItemsMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAssetActions({
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        refreshAssetSilently,
        clearSelectedImportItemIds,
        t,
      }),
    );

    act(() => {
      result.current.onConfirmSelectedImportBatchItems({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-1", "import-item-2"],
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("success");
    });

    expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-1", "import-item-2"],
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(refreshAssetSilently).toHaveBeenCalledTimes(1);
    expect(clearSelectedImportItemIds).toHaveBeenCalledTimes(1);
  });

  it("keeps detail/selection state untouched on failure, keeps selection on primary-asset success, and ignores empty confirm-all", async () => {
    const refreshAssetSilently = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const clearSelectedImportItemIds = vi.fn();
    confirmImportBatchItemMock.mockRejectedValueOnce(new Error("asset action exploded"));
    selectPrimaryAssetForImportBatchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAssetActions({
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        refreshAssetSilently,
        clearSelectedImportItemIds,
        t,
      }),
    );

    act(() => {
      result.current.onConfirmImportBatchItem({
        importBatchId: "import-batch-1",
        itemId: "import-item-1",
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("error");
    });

    expect(clearSelectedImportItemIds).not.toHaveBeenCalled();

    act(() => {
      result.current.onSelectPrimaryAsset({
        shotExecutionId: "shot-exec-1",
        assetId: "media-asset-1",
      });
    });

    await waitFor(() => {
      expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-1",
        assetId: "media-asset-1",
        orgId: "org-demo-001",
        userId: "user-demo-001",
      });
    });

    expect(clearSelectedImportItemIds).not.toHaveBeenCalled();

    act(() => {
      result.current.onConfirmAllImportBatchItems({
        importBatchId: "import-batch-1",
        itemIds: [],
      });
    });

    expect(confirmImportBatchItemsMock).not.toHaveBeenCalled();
  });
});
