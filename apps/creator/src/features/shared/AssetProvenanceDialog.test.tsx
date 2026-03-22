import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AssetProvenanceDialog } from "./AssetProvenanceDialog";

function createAssetProvenanceDetail(assetId: string) {
  return {
    asset: {
      id: assetId,
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
  };
}

describe("AssetProvenanceDialog", () => {
  it("renders provenance details and closes on escape", async () => {
    const onCloseAssetProvenance = vi.fn();

    render(
      <AssetProvenanceDialog
        assetProvenanceDetail={createAssetProvenanceDetail("asset-1")}
        onCloseAssetProvenance={onCloseAssetProvenance}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "素材来源详情" })).toBeInTheDocument();
    expect(screen.getByText("asset-1")).toBeInTheDocument();
    expect(screen.getByText(/source_type=upload_session/)).toBeInTheDocument();
    expect(screen.getByText("候选素材 ID：candidate-1")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "关闭来源详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseAssetProvenance).toHaveBeenCalledTimes(1);
  });

  it("renders loading and error states while keeping the dialog dismissible", () => {
    const onCloseAssetProvenance = vi.fn();
    const { rerender } = render(
      <AssetProvenanceDialog
        assetProvenancePending
        onCloseAssetProvenance={onCloseAssetProvenance}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "素材来源详情" })).toBeInTheDocument();
    expect(screen.getByText("正在加载素材来源详情")).toBeInTheDocument();

    rerender(
      <AssetProvenanceDialog
        assetProvenanceErrorMessage="来源详情加载失败：network down"
        onCloseAssetProvenance={onCloseAssetProvenance}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByText("来源详情加载失败：network down")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭来源详情" }));
    expect(onCloseAssetProvenance).toHaveBeenCalledTimes(1);
  });
});
