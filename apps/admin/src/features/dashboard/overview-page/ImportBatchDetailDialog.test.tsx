import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import {
  createAssetBatchDetail,
  createAssetProvenanceDetail,
} from "../assetMonitor.test-data";
import { ImportBatchDetailDialog } from "./ImportBatchDetailDialog";

const actionableAssetDetail = {
  ...createAssetBatchDetail("project-live-1"),
  items: [
    {
      id: "import-item-1",
      status: "confirmed",
      assetId: "media-asset-1",
    },
    {
      id: "import-item-2",
      status: "matched_pending_confirm",
      assetId: "media-asset-2",
    },
    {
      id: "import-item-3",
      status: "pending_review",
      assetId: "",
    },
    {
      id: "import-item-4",
      status: "matched_pending_confirm",
      assetId: "media-asset-4",
    },
  ],
  candidateAssets: [
    {
      id: "candidate-1",
      shotExecutionId: "shot-exec-1",
      assetId: "media-asset-1",
      sourceRunId: "workflow-run-1",
    },
    {
      id: "candidate-2",
      shotExecutionId: "",
      assetId: "media-asset-2",
      sourceRunId: "workflow-run-2",
    },
    {
      id: "candidate-3",
      shotExecutionId: "shot-exec-3",
      assetId: "",
      sourceRunId: "workflow-run-3",
    },
  ],
};

describe("ImportBatchDetailDialog", () => {
  it("supports single, bulk, confirm-all, provenance, and primary-asset actions", async () => {
    const onToggleImportBatchItemSelection = vi.fn();
    const onConfirmImportBatchItem = vi.fn();
    const onConfirmSelectedImportBatchItems = vi.fn();
    const onConfirmAllImportBatchItems = vi.fn();
    const onSelectPrimaryAsset = vi.fn();
    const onSelectAssetProvenance = vi.fn();
    const onCloseImportBatchDetail = vi.fn();

    render(
      <ImportBatchDetailDialog
        importBatchDetail={actionableAssetDetail}
        selectedImportItemIds={["import-item-2"]}
        onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
        onConfirmImportBatchItem={onConfirmImportBatchItem}
        onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
        onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
        onSelectPrimaryAsset={onSelectPrimaryAsset}
        onSelectAssetProvenance={onSelectAssetProvenance}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        assetActionFeedback={{
          tone: "success",
          message: "已确认所选匹配",
        }}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    expect(screen.getByText("已选 1 项 / 可确认 2 项")).toBeInTheDocument();
    expect(screen.getByText("已确认所选匹配")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" }));
    expect(onToggleImportBatchItemSelection).toHaveBeenCalledWith({
      itemId: "import-item-2",
      checked: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "确认导入条目 import-item-2" }));
    expect(onConfirmImportBatchItem).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemId: "import-item-2",
    });

    fireEvent.click(screen.getByRole("button", { name: "确认已选项" }));
    expect(onConfirmSelectedImportBatchItems).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-2"],
    });

    fireEvent.click(screen.getByRole("button", { name: "确认全部可确认项" }));
    expect(onConfirmAllImportBatchItems).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-2", "import-item-4"],
    });

    fireEvent.click(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" }));
    expect(onSelectPrimaryAsset).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "media-asset-1",
    });

    fireEvent.click(screen.getAllByRole("button", { name: "查看资源来源 media-asset-1" })[0]!);
    expect(onSelectAssetProvenance).toHaveBeenCalledWith("media-asset-1");

    const closeButton = screen.getByRole("button", { name: "关闭导入批次详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseImportBatchDetail).toHaveBeenCalled();
  });

  it("disables actions while an asset action is pending", () => {
    render(
      <ImportBatchDetailDialog
        importBatchDetail={actionableAssetDetail}
        selectedImportItemIds={["import-item-2"]}
        assetActionPending
        assetActionFeedback={{
          tone: "pending",
          message: "正在确认已选匹配",
        }}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认导入条目 import-item-2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认已选项" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认全部可确认项" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" })).toBeDisabled();
  });
});
