import { describe, expect, it } from "vitest";
import { normalizeAdminAssetReuseAudit } from "./adminAssetReuse";

describe("normalizeAdminAssetReuseAudit", () => {
  it("marks a cross-project primary asset as reusable only when rights are clear and aiAnnotated is false", () => {
    const audit = normalizeAdminAssetReuseAudit({
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
        candidateAssetId: "",
        shotExecutionId: "shot-exec-source-1",
        sourceRunId: "run-source-1",
        importBatchId: "batch-source-1",
        variantCount: 1,
      },
    });

    expect(audit.summary).toEqual({
      isCrossProject: true,
      isEligible: true,
      blockedReason: "",
      sourceProjectId: "project-source-9",
    });
  });

  it("fails closed when the current primary asset is aiAnnotated and consent status is unavailable", () => {
    const audit = normalizeAdminAssetReuseAudit({
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        projectId: "project-live-1",
        status: "primary_selected",
        primaryAssetId: "asset-external-ai-1",
      },
      assetProvenanceDetail: {
        asset: {
          id: "asset-external-ai-1",
          projectId: "project-source-9",
          sourceType: "upload_session",
          rightsStatus: "clear",
          importBatchId: "batch-source-1",
          locale: "zh-CN",
          aiAnnotated: true,
        },
        provenanceSummary: "source_type=upload_session rights_status=clear",
        candidateAssetId: "",
        shotExecutionId: "shot-exec-source-1",
        sourceRunId: "run-source-1",
        importBatchId: "batch-source-1",
        variantCount: 1,
      },
    });

    expect(audit.summary).toEqual({
      isCrossProject: true,
      isEligible: false,
      blockedReason: "admin: consent status is unavailable for ai_annotated assets",
      sourceProjectId: "project-source-9",
    });
  });
});
