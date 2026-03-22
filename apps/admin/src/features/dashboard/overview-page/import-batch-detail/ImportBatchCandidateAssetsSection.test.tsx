import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../../i18n";
import { createAssetBatchDetail } from "../../assetMonitor.test-data";
import { ImportBatchCandidateAssetsSection } from "./ImportBatchCandidateAssetsSection";

describe("ImportBatchCandidateAssetsSection", () => {
  it("renders provenance and primary-asset actions and hides primary-asset CTA when no shot execution exists", () => {
    const onSelectAssetProvenance = vi.fn();
    const onSelectPrimaryAsset = vi.fn();
    const detail = {
      ...createAssetBatchDetail("project-live-1"),
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
      ],
    };

    render(
      <ImportBatchCandidateAssetsSection
        candidateAssets={detail.candidateAssets}
        onSelectAssetProvenance={onSelectAssetProvenance}
        onSelectPrimaryAsset={onSelectPrimaryAsset}
        t={createTranslator("zh-CN")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看资源来源 media-asset-1" }));
    expect(onSelectAssetProvenance).toHaveBeenCalledWith("media-asset-1");

    fireEvent.click(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" }));
    expect(onSelectPrimaryAsset).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "media-asset-1",
    });

    expect(
      screen.queryByRole("button", { name: "设置候选资源 candidate-2 为主素材" }),
    ).not.toBeInTheDocument();
  });
});
