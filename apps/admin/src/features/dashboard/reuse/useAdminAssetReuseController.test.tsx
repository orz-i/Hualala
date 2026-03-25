import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import { loadAdminAssetReuseAudit } from "./loadAdminAssetReuseAudit";
import { useAdminAssetReuseController } from "./useAdminAssetReuseController";

vi.mock("./loadAdminAssetReuseAudit", () => ({
  loadAdminAssetReuseAudit: vi.fn(),
}));

vi.mock("../loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

const loadAdminAssetReuseAuditMock = vi.mocked(loadAdminAssetReuseAudit);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);

describe("useAdminAssetReuseController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminAssetReuseAuditMock.mockResolvedValue({
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
          consentStatus: "not_required",
          importBatchId: "batch-source-1",
          locale: "zh-CN",
          aiAnnotated: false,
        },
        provenanceSummary: "source_type=upload_session rights_status=clear consent_status=not_required",
        candidateAssetId: "candidate-source-1",
        shotExecutionId: "shot-exec-source-1",
        sourceRunId: "run-source-1",
        importBatchId: "batch-source-1",
        variantCount: 1,
      },
      summary: {
        isCrossProject: true,
        isEligible: true,
        blockedReason: "",
        sourceProjectId: "project-source-9",
      },
    });
    loadAssetProvenanceDetailsMock.mockResolvedValue({
      asset: {
        id: "asset-external-1",
        projectId: "project-source-9",
        sourceType: "upload_session",
        rightsStatus: "clear",
        consentStatus: "not_required",
        importBatchId: "batch-source-1",
        locale: "zh-CN",
        aiAnnotated: false,
      },
      provenanceSummary: "source_type=upload_session rights_status=clear consent_status=not_required",
      candidateAssetId: "candidate-source-1",
      shotExecutionId: "shot-exec-source-1",
      sourceRunId: "run-source-1",
      importBatchId: "batch-source-1",
      variantCount: 1,
    });
  });

  it("loads reuse audit only when enabled and the session is ready", async () => {
    const { result, rerender } = renderHook(
      (props: { sessionState: "loading" | "ready"; enabled: boolean }) =>
        useAdminAssetReuseController({
          ...props,
          projectId: "project-live-1",
          shotExecutionId: "shot-exec-live-1",
          effectiveOrgId: "org-live-1",
          effectiveUserId: "user-live-1",
          t,
        }),
      {
        initialProps: {
          sessionState: "loading",
          enabled: false,
        },
      },
    );

    expect(loadAdminAssetReuseAuditMock).not.toHaveBeenCalled();
    expect(result.current.audit).toBeNull();

    rerender({
      sessionState: "ready",
      enabled: true,
    });

    await waitFor(() => {
      expect(result.current.audit?.summary.sourceProjectId).toBe("project-source-9");
    });
  });

  it("opens asset provenance details for the audited primary asset", async () => {
    const { result } = renderHook(() =>
      useAdminAssetReuseController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-live-1",
        shotExecutionId: "shot-exec-live-1",
        effectiveOrgId: "org-live-1",
        effectiveUserId: "user-live-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.audit?.shotExecution.primaryAssetId).toBe("asset-external-1");
    });

    await act(async () => {
      await result.current.handleOpenAssetProvenance("asset-external-1");
    });

    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
      assetId: "asset-external-1",
      orgId: "org-live-1",
      userId: "user-live-1",
    });
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("asset-external-1");
  });
});
