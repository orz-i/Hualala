import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { createAssetMonitor } from "../assetMonitor.test-data";
import { AssetMonitorPanel } from "./AssetMonitorPanel";

describe("AssetMonitorPanel", () => {
  it("filters asset batches and opens the detail CTA", () => {
    const onAssetStatusFilterChange = vi.fn();
    const onAssetSourceTypeFilterChange = vi.fn();
    const onSelectImportBatch = vi.fn();

    render(
      <AssetMonitorPanel
        assetMonitor={createAssetMonitor("project-live-1")}
        t={createTranslator("zh-CN")}
        onAssetStatusFilterChange={onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
        onSelectImportBatch={onSelectImportBatch}
      />,
    );

    fireEvent.change(screen.getByLabelText("资产状态过滤"), {
      target: { value: "matched_pending_confirm" },
    });
    fireEvent.change(screen.getByLabelText("资产来源过滤"), {
      target: { value: "workflow_import" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));

    expect(onAssetStatusFilterChange).toHaveBeenCalledWith("matched_pending_confirm");
    expect(onAssetSourceTypeFilterChange).toHaveBeenCalledWith("workflow_import");
    expect(onSelectImportBatch).toHaveBeenCalledWith("import-batch-1");
  });
});
