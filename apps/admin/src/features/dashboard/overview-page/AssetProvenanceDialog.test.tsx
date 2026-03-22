import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { createAssetProvenanceDetail } from "../assetMonitor.test-data";
import { AssetProvenanceDialog } from "./AssetProvenanceDialog";

describe("AssetProvenanceDialog", () => {
  it("renders provenance details and closes on escape", async () => {
    const onCloseAssetProvenance = vi.fn();

    render(
      <AssetProvenanceDialog
        assetProvenanceDetail={createAssetProvenanceDetail("project-live-1")}
        onCloseAssetProvenance={onCloseAssetProvenance}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "资源来源详情" })).toBeInTheDocument();
    expect(screen.getByText(/source_type=upload_session/)).toBeInTheDocument();
    expect(screen.getByText("候选资源 ID：candidate-1")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "关闭资源来源详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseAssetProvenance).toHaveBeenCalled();
  });
});
