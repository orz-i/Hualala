import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../../i18n";
import { createAssetBatchDetail } from "../../assetMonitor.test-data";
import { ImportBatchMediaAssetsSection } from "./ImportBatchMediaAssetsSection";

describe("ImportBatchMediaAssetsSection", () => {
  it("renders media assets and provenance actions", () => {
    const onSelectAssetProvenance = vi.fn();
    const detail = createAssetBatchDetail("project-live-1");

    render(
      <ImportBatchMediaAssetsSection
        mediaAssets={detail.mediaAssets}
        onSelectAssetProvenance={onSelectAssetProvenance}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByText("media-asset-1")).toBeInTheDocument();
    expect(screen.getByText("upload_session · clear · 语言 zh-CN")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看资源来源 media-asset-1" }));
    expect(onSelectAssetProvenance).toHaveBeenCalledWith("media-asset-1");
  });
});
