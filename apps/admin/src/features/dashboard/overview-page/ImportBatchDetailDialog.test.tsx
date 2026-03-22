import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { createAssetBatchDetail } from "../assetMonitor.test-data";
import { ImportBatchDetailDialog } from "./ImportBatchDetailDialog";

describe("ImportBatchDetailDialog", () => {
  it("renders the dialog shell, metadata, and upload-session sections, then focuses and closes from the shell controls", async () => {
    const onCloseImportBatchDetail = vi.fn();

    render(
      <ImportBatchDetailDialog
        importBatchDetail={createAssetBatchDetail("project-live-1")}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    expect(screen.getByText("项目 ID：project-live-1")).toBeInTheDocument();
    expect(screen.getByText("组织 ID：org-live-1")).toBeInTheDocument();
    expect(screen.getByText("上传会话")).toBeInTheDocument();
    expect(screen.getByText("hero.png")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "关闭导入批次详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseImportBatchDetail).toHaveBeenCalledTimes(1);
  });

  it("mounts the feedback banner and asset detail sections without re-testing section internals", () => {
    render(
      <ImportBatchDetailDialog
        importBatchDetail={createAssetBatchDetail("project-live-1")}
        selectedImportItemIds={["import-item-1"]}
        assetActionFeedback={{
          tone: "success",
          message: "已确认所选匹配",
        }}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByText("已确认所选匹配")).toBeInTheDocument();
    expect(screen.getByText("导入条目")).toBeInTheDocument();
    expect(screen.getByText("候选资源")).toBeInTheDocument();
    expect(screen.getByText("媒体资源")).toBeInTheDocument();
  });
});
