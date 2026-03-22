import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import {
  createAssetBatchDetail,
  createAssetMonitor,
  createAssetProvenanceDetail,
} from "./assetMonitor.test-data";
import type { AssetMonitorViewModel } from "./assetMonitor";
import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "./loadImportBatchDetails";
import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "./mutateAssetMonitor";
import { useAdminAssetController } from "./useAdminAssetController";

vi.mock("./loadAssetMonitorPanel", () => ({
  loadAssetMonitorPanel: vi.fn(),
}));
vi.mock("./loadImportBatchDetails", () => ({
  loadImportBatchDetails: vi.fn(),
}));
vi.mock("./loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));
vi.mock("./mutateAssetMonitor", async () => {
  const actual = await vi.importActual<typeof import("./mutateAssetMonitor")>("./mutateAssetMonitor");
  return {
    ...actual,
    confirmImportBatchItem: vi.fn(),
    confirmImportBatchItems: vi.fn(),
    selectPrimaryAssetForImportBatch: vi.fn(),
  };
});
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadAssetMonitorPanelMock = vi.mocked(loadAssetMonitorPanel);
const loadImportBatchDetailsMock = vi.mocked(loadImportBatchDetails);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);
const confirmImportBatchItemsMock = vi.mocked(confirmImportBatchItems);
const selectPrimaryAssetForImportBatchMock = vi.mocked(selectPrimaryAssetForImportBatch);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("useAdminAssetController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads batch and provenance details, then clears them when the batch drawer closes", async () => {
    loadAssetMonitorPanelMock.mockResolvedValueOnce(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock.mockResolvedValueOnce(createAssetBatchDetail("project-live-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValueOnce(createAssetProvenanceDetail("project-live-001"));

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    act(() => {
      result.current.onSelectAssetProvenance("media-asset-1");
    });

    await waitFor(() => {
      expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
    });

    act(() => {
      result.current.onCloseImportBatchDetail();
    });

    expect(result.current.importBatchDetail).toBeNull();
    expect(result.current.assetProvenanceDetail).toBeNull();
    expect(result.current.selectedImportItemIds).toEqual([]);
  });

  it("confirms selected import items, refreshes data, and clears selection on success", async () => {
    loadAssetMonitorPanelMock
      .mockResolvedValueOnce(createAssetMonitor("project-live-001"))
      .mockResolvedValue(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock
      .mockResolvedValueOnce(createAssetBatchDetail("project-live-001"))
      .mockResolvedValue(createAssetBatchDetail("project-live-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValue(createAssetProvenanceDetail("project-live-001"));
    confirmImportBatchItemsMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    act(() => {
      result.current.onToggleImportBatchItemSelection({ itemId: "import-item-1", checked: true });
      result.current.onToggleImportBatchItemSelection({ itemId: "import-item-2", checked: true });
    });

    await act(async () => {
      await result.current.onConfirmSelectedImportBatchItems({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-1", "import-item-2"],
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("success");
    });

    expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-1", "import-item-2"],
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(result.current.selectedImportItemIds).toEqual([]);
    expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
  });

  it("selects a primary asset, refreshes data, and keeps the batch detail open", async () => {
    loadAssetMonitorPanelMock
      .mockResolvedValueOnce(createAssetMonitor("project-live-001"))
      .mockResolvedValue(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock
      .mockResolvedValueOnce(createAssetBatchDetail("project-live-001"))
      .mockResolvedValue(createAssetBatchDetail("project-live-001"));
    selectPrimaryAssetForImportBatchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    await act(async () => {
      await result.current.onSelectPrimaryAsset({
        shotExecutionId: "shot-exec-live-1",
        assetId: "asset-media-2",
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("success");
    });

    expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-live-1",
      assetId: "asset-media-2",
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
  });

  it("keeps open details and selected items when asset actions fail", async () => {
    loadAssetMonitorPanelMock.mockResolvedValueOnce(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock.mockResolvedValueOnce(createAssetBatchDetail("project-live-001"));
    confirmImportBatchItemsMock.mockRejectedValueOnce(new Error("asset action exploded"));

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    act(() => {
      result.current.onToggleImportBatchItemSelection({ itemId: "import-item-1", checked: true });
    });

    await act(async () => {
      await result.current.onConfirmSelectedImportBatchItems({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-1"],
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("error");
    });

    expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    expect(result.current.selectedImportItemIds).toEqual(["import-item-1"]);
    expect(result.current.assetActionFeedback?.message).toContain("asset action exploded");
  });

  it("queues at most one extra silent asset refresh while a refresh is already running", async () => {
    const monitorDeferred = createDeferred<AssetMonitorViewModel>();
    loadAssetMonitorPanelMock.mockResolvedValueOnce(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock.mockResolvedValueOnce(createAssetBatchDetail("project-live-001"));

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectImportBatch("import-batch-1");
    });

    await waitFor(() => {
      expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    });

    loadAssetMonitorPanelMock.mockReturnValue(monitorDeferred.promise);
    loadImportBatchDetailsMock.mockResolvedValue(createAssetBatchDetail("project-live-001"));

    const firstRefresh = result.current.refreshAssetSilently();
    const secondRefresh = result.current.refreshAssetSilently();
    const thirdRefresh = result.current.refreshAssetSilently();

    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      monitorDeferred.resolve(createAssetMonitor("project-live-001"));
      await Promise.all([firstRefresh, secondRefresh, thirdRefresh]);
    });

    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(3);
    });
  });
});
