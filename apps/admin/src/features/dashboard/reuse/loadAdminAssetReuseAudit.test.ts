import { describe, expect, it, vi } from "vitest";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import { loadAdminAssetReuseAudit } from "./loadAdminAssetReuseAudit";

vi.mock("../loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);

describe("loadAdminAssetReuseAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads shot execution first, then derives a cross-project reuse audit from provenance", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          shotExecution: {
            id: "shot-exec-live-1",
            shotId: "shot-live-1",
            projectId: "project-live-1",
            status: "primary_selected",
            primaryAssetId: "asset-external-1",
          },
        }),
        { status: 200 },
      ),
    );

    loadAssetProvenanceDetailsMock.mockResolvedValueOnce({
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
    });

    const audit = await loadAdminAssetReuseAudit({
      projectId: "project-live-1",
      shotExecutionId: "shot-exec-live-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.execution.v1.ExecutionService/GetShotExecution",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
      assetId: "asset-external-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    expect(audit.summary).toEqual({
      isCrossProject: true,
      isEligible: true,
      blockedReason: "",
      sourceProjectId: "project-source-9",
    });
  });

  it("skips provenance loading when the shot has no primary asset", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          shotExecution: {
            id: "shot-exec-live-1",
            shotId: "shot-live-1",
            projectId: "project-live-1",
            status: "candidate_ready",
            primaryAssetId: "",
          },
        }),
        { status: 200 },
      ),
    );

    const audit = await loadAdminAssetReuseAudit({
      projectId: "project-live-1",
      shotExecutionId: "shot-exec-live-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(loadAssetProvenanceDetailsMock).not.toHaveBeenCalled();
    expect(audit.summary).toEqual({
      isCrossProject: false,
      isEligible: false,
      blockedReason: "",
      sourceProjectId: "",
    });
  });
});
