import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AssetReusePage } from "./AssetReusePage";

describe("AssetReusePage", () => {
  const t = createTranslator("zh-CN");

  it("loads source project assets, applies allowed reuse, and fails closed for blocked assets", () => {
    const onSourceProjectIdInputChange = vi.fn();
    const onLoadSourceProject = vi.fn();
    const onApplyReuse = vi.fn();
    const onOpenAssetProvenance = vi.fn();
    const onBackToShotWorkbench = vi.fn();

    render(
      <AssetReusePage
        shotWorkbench={{
          shotExecution: {
            id: "shot-exec-live-1",
            shotId: "shot-live-1",
            orgId: "org-live-1",
            projectId: "project-live-1",
            status: "primary_selected",
            primaryAssetId: "asset-current-1",
          },
          candidateAssets: [],
          reviewSummary: {
            latestConclusion: "approved",
          },
          latestEvaluationRun: {
            id: "eval-1",
            status: "passed",
          },
          reviewTimeline: {
            evaluationRuns: [],
            shotReviews: [],
          },
        }}
        reusableAssets={[
          {
            assetId: "asset-external-1",
            sourceProjectId: "project-source-9",
            importBatchId: "batch-source-1",
            fileName: "hero-shot.png",
            mediaType: "image",
            sourceType: "upload_session",
            rightsStatus: "clear",
            consentStatus: "not_required",
            locale: "zh-CN",
            aiAnnotated: false,
            sourceRunId: "run-source-1",
            mimeType: "image/png",
            allowed: true,
            blockedReason: "",
          },
          {
            assetId: "asset-external-ai-1",
            sourceProjectId: "project-source-9",
            importBatchId: "batch-source-1",
            fileName: "hero-shot-ai.png",
            mediaType: "image",
            sourceType: "upload_session",
            rightsStatus: "clear",
            consentStatus: "unknown",
            locale: "zh-CN",
            aiAnnotated: true,
            sourceRunId: "run-source-2",
            mimeType: "image/png",
            allowed: false,
            blockedReason: "policyapp: consent status must be granted for ai_annotated assets",
          },
        ]}
        sourceProjectIdInput="project-source-9"
        loading={false}
        errorMessage=""
        feedback={null}
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onSourceProjectIdInputChange={onSourceProjectIdInputChange}
        onLoadSourceProject={onLoadSourceProject}
        onApplyReuse={onApplyReuse}
        onOpenAssetProvenance={onOpenAssetProvenance}
        onCloseAssetProvenance={vi.fn()}
        onBackToShotWorkbench={onBackToShotWorkbench}
      />,
    );

    fireEvent.change(screen.getByLabelText("来源项目 ID"), {
      target: { value: "project-source-8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加载外部项目素材" }));
    fireEvent.click(screen.getByRole("button", { name: "返回镜头工作台" }));

    const allowedCard = screen.getByText("asset-external-1").closest("article") as HTMLElement;
    const blockedCard = screen
      .getByText("asset-external-ai-1")
      .closest("article") as HTMLElement;

    fireEvent.click(
      within(allowedCard).getByRole("button", { name: "复用为当前镜头主素材" }),
    );
    fireEvent.click(within(allowedCard).getByRole("button", { name: "查看来源" }));

    expect(
      within(blockedCard).getByRole("button", { name: "复用为当前镜头主素材" }),
    ).toBeDisabled();
    expect(
      within(blockedCard).getByText(
        "policyapp: consent status must be granted for ai_annotated assets",
      ),
    ).toBeInTheDocument();
    expect(within(blockedCard).getByText(/consent/i)).toBeInTheDocument();

    expect(onSourceProjectIdInputChange).toHaveBeenCalledWith("project-source-8");
    expect(onLoadSourceProject).toHaveBeenCalledTimes(1);
    expect(onBackToShotWorkbench).toHaveBeenCalledWith("shot-live-1");
    expect(onApplyReuse).toHaveBeenCalledWith("asset-external-1");
    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-external-1");
  });
});
