import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { AdminAssetReusePage } from "./AdminAssetReusePage";

describe("AdminAssetReusePage", () => {
  const t = createTranslator("zh-CN");

  it("shows cross-project reuse summary, blocked reason, and provenance entry", () => {
    const onOpenAssetProvenance = vi.fn();

    render(
      <AdminAssetReusePage
        audit={{
          shotExecution: {
            id: "shot-exec-live-1",
            shotId: "shot-live-1",
            projectId: "project-live-1",
            status: "primary_selected",
            primaryAssetId: "asset-external-1",
          },
          assetProvenanceDetail: {
            asset: {
              id: "asset-external-1",
              projectId: "project-source-9",
              sourceType: "upload_session",
              rightsStatus: "clear",
              importBatchId: "batch-source-1",
              locale: "zh-CN",
              aiAnnotated: false,
            },
            provenanceSummary: "source_type=upload_session rights_status=clear",
            candidateAssetId: "candidate-source-1",
            shotExecutionId: "shot-exec-source-1",
            sourceRunId: "run-source-1",
            importBatchId: "batch-source-1",
            variantCount: 1,
          },
          summary: {
            isCrossProject: true,
            isEligible: false,
            blockedReason: "admin: rights status does not allow cross-project reuse",
            sourceProjectId: "project-source-9",
          },
        }}
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onOpenAssetProvenance={onOpenAssetProvenance}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    expect(screen.getByText("来源项目 ID：project-source-9")).toBeInTheDocument();
    expect(screen.getByText("admin: rights status does not allow cross-project reuse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看来源" }));

    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-external-1");
  });
});
