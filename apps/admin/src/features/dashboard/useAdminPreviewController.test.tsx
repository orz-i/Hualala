import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadAdminPreviewWorkbench } from "./loadAdminPreviewWorkbench";
import { useAdminPreviewController } from "./useAdminPreviewController";

vi.mock("./loadAdminPreviewWorkbench", () => ({
  loadAdminPreviewWorkbench: vi.fn(),
}));

vi.mock("./loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

const loadAdminPreviewWorkbenchMock = vi.mocked(loadAdminPreviewWorkbench);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);

function buildPreviewWorkbench() {
  return {
    assembly: {
      assemblyId: "assembly-project-1",
      projectId: "project-1",
      episodeId: "",
      status: "draft",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:05:00.000Z",
    },
    items: [
      {
        itemId: "item-1",
        assemblyId: "assembly-project-1",
        shotId: "shot-1",
        primaryAssetId: "",
        sourceRunId: "",
        sequence: 1,
      },
      {
        itemId: "item-2",
        assemblyId: "assembly-project-1",
        shotId: "shot-2",
        primaryAssetId: "asset-2",
        sourceRunId: "run-2",
        sequence: 2,
      },
    ],
    summary: {
      itemCount: 2,
      missingPrimaryAssetCount: 1,
    },
  };
}

describe("useAdminPreviewController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminPreviewWorkbenchMock.mockResolvedValue(buildPreviewWorkbench());
    loadAssetProvenanceDetailsMock.mockResolvedValue({
      asset: {
        id: "asset-2",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary: "source_type=upload_session rights_status=clear",
      candidateAssetId: "candidate-2",
      shotExecutionId: "shot-exec-2",
      sourceRunId: "run-2",
      importBatchId: "batch-1",
      variantCount: 2,
    });
  });

  it("loads preview data only when enabled and the session is ready", async () => {
    const { result, rerender } = renderHook(
      (props: { sessionState: "loading" | "ready"; enabled: boolean }) =>
        useAdminPreviewController({
          ...props,
          projectId: "project-1",
          effectiveOrgId: "org-1",
          effectiveUserId: "user-1",
          t,
        }),
      {
        initialProps: {
          sessionState: "loading",
          enabled: false,
        },
      },
    );

    expect(loadAdminPreviewWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.previewWorkbench).toBeNull();

    rerender({
      sessionState: "ready",
      enabled: true,
    });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.summary.itemCount).toBe(2);
    });
  });

  it("opens asset provenance details for preview items", async () => {
    const { result } = renderHook(() =>
      useAdminPreviewController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.summary.itemCount).toBe(2);
    });

    await act(async () => {
      await result.current.handleOpenAssetProvenance("asset-2");
    });

    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
      assetId: "asset-2",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("asset-2");
  });
});
