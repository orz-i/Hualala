import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../../i18n";
import { createAssetBatchDetail } from "../../assetMonitor.test-data";
import { deriveImportBatchSelections } from "./helpers";
import { ImportBatchItemsSection } from "./ImportBatchItemsSection";

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
};

describe("ImportBatchItemsSection", () => {
  it("renders selection summary and supports single, selected, and all confirm actions", () => {
    const onToggleImportBatchItemSelection = vi.fn();
    const onConfirmImportBatchItem = vi.fn();
    const onConfirmSelectedImportBatchItems = vi.fn();
    const onConfirmAllImportBatchItems = vi.fn();
    const derivedSelections = deriveImportBatchSelections(
      actionableAssetDetail,
      ["import-item-2"],
    );

    render(
      <ImportBatchItemsSection
        importBatchDetail={actionableAssetDetail}
        selectedImportItemIds={["import-item-2"]}
        derivedSelections={derivedSelections}
        onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
        onConfirmImportBatchItem={onConfirmImportBatchItem}
        onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
        onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByText("已选 1 项 / 可确认 2 项")).toBeInTheDocument();

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
  });

  it("disables confirm controls while pending", () => {
    const derivedSelections = deriveImportBatchSelections(
      actionableAssetDetail,
      ["import-item-2"],
    );

    render(
      <ImportBatchItemsSection
        importBatchDetail={actionableAssetDetail}
        selectedImportItemIds={["import-item-2"]}
        derivedSelections={derivedSelections}
        assetActionPending
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认导入条目 import-item-2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认已选项" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认全部可确认项" })).toBeDisabled();
  });
});
