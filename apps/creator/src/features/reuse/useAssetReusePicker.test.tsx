import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadShotWorkbench } from "../shot-workbench/loadShotWorkbench";
import { selectPrimaryAssetForShotWorkbench } from "../shot-workbench/mutateShotWorkbench";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadReusableAssetLibrary } from "./loadReusableAssetLibrary";
import { useAssetReusePicker } from "./useAssetReusePicker";

vi.mock("../shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));

vi.mock("../shot-workbench/mutateShotWorkbench", () => ({
  selectPrimaryAssetForShotWorkbench: vi.fn(),
}));

vi.mock("../shared/useAssetProvenanceState", () => ({
  useAssetProvenanceState: vi.fn(),
}));

vi.mock("./loadReusableAssetLibrary", () => ({
  loadReusableAssetLibrary: vi.fn(),
}));

const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);
const selectPrimaryAssetForShotWorkbenchMock = vi.mocked(selectPrimaryAssetForShotWorkbench);
const useAssetProvenanceStateMock = vi.mocked(useAssetProvenanceState);
const loadReusableAssetLibraryMock = vi.mocked(loadReusableAssetLibrary);

describe("useAssetReusePicker", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    useAssetProvenanceStateMock.mockReturnValue({
      selectedAssetId: null,
      assetProvenanceDetail: null,
      assetProvenanceStatus: "idle",
      assetProvenancePending: false,
      assetProvenanceErrorMessage: "",
      handleOpenAssetProvenance: vi.fn(),
      handleCloseAssetProvenance: vi.fn(),
      resetAssetProvenance: vi.fn(),
    } as never);
    loadShotWorkbenchMock.mockResolvedValue({
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
    });
    loadReusableAssetLibraryMock.mockResolvedValue([
      {
        assetId: "asset-external-1",
        sourceProjectId: "project-source-9",
        importBatchId: "batch-source-1",
        fileName: "hero-shot.png",
        mediaType: "image",
        sourceType: "upload_session",
        rightsStatus: "clear",
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
        locale: "zh-CN",
        aiAnnotated: true,
        sourceRunId: "run-source-2",
        mimeType: "image/png",
        allowed: false,
        blockedReason: "creator: consent status is unavailable for ai_annotated assets",
      },
    ]);
    selectPrimaryAssetForShotWorkbenchMock.mockResolvedValue();
  });

  it("loads the target shot and external asset library, then applies an allowed external asset as primary", async () => {
    const { result } = renderHook(() =>
      useAssetReusePicker({
        enabled: true,
        projectId: "project-live-1",
        shotId: "shot-live-1",
        sourceProjectId: "project-source-9",
        t,
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.shotWorkbench?.shotExecution.id).toBe("shot-exec-live-1");
    });

    expect(result.current.reusableAssets.map((item) => item.assetId)).toEqual([
      "asset-external-1",
      "asset-external-ai-1",
    ]);

    await act(async () => {
      await result.current.handleApplyReuse("asset-external-1");
    });

    expect(selectPrimaryAssetForShotWorkbenchMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-live-1",
      assetId: "asset-external-1",
      orgId: "org-live-1",
      userId: "user-live-1",
    });
    expect(result.current.shotWorkbench?.shotExecution.primaryAssetId).toBe("asset-external-1");
  });

  it("fails closed for blocked assets and does not mutate the current shot", async () => {
    const { result } = renderHook(() =>
      useAssetReusePicker({
        enabled: true,
        projectId: "project-live-1",
        shotId: "shot-live-1",
        sourceProjectId: "project-source-9",
        t,
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.reusableAssets).toHaveLength(2);
    });

    await act(async () => {
      await result.current.handleApplyReuse("asset-external-ai-1");
    });

    expect(selectPrimaryAssetForShotWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.feedback?.tone).toBe("error");
    expect(result.current.shotWorkbench?.shotExecution.primaryAssetId).toBe("asset-current-1");
  });

  it("keeps the target shot visible when the external asset library fails to load", async () => {
    loadReusableAssetLibraryMock.mockRejectedValueOnce(new Error("library exploded"));

    const { result } = renderHook(() =>
      useAssetReusePicker({
        enabled: true,
        projectId: "project-live-1",
        shotId: "shot-live-1",
        sourceProjectId: "project-source-9",
        t,
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.shotWorkbench?.shotExecution.id).toBe("shot-exec-live-1");
    });

    expect(result.current.reusableAssets).toEqual([]);
    expect(result.current.errorMessage).toBe("library exploded");
    expect(result.current.loading).toBe(false);
  });
});
