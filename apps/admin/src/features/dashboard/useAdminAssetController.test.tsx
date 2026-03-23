import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import {
  createAssetBatchDetail,
  createAssetMonitor,
  createAssetProvenanceDetail,
} from "./assetMonitor.test-data";
import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "./loadImportBatchDetails";
import { confirmImportBatchItems } from "./mutateAssetMonitor";
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

describe("useAdminAssetController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the asset contract that App consumes", async () => {
    loadAssetMonitorPanelMock.mockResolvedValueOnce(createAssetMonitor("project-live-001"));

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        enabled: true,
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

    expect(result.current.importBatchDetail).toBeNull();
    expect(result.current.assetProvenanceDetail).toBeNull();
    expect(result.current.selectedImportBatchId).toBeNull();
    expect(result.current.selectedAssetProvenanceId).toBeNull();
    expect(result.current.selectedImportItemIds).toEqual([]);
    expect(result.current.assetActionFeedback).toBeNull();
    expect(result.current.assetActionPending).toBe(false);
    expect(result.current.refreshAssetSilently).toEqual(expect.any(Function));
    expect(result.current.onAssetStatusFilterChange).toEqual(expect.any(Function));
    expect(result.current.onAssetSourceTypeFilterChange).toEqual(expect.any(Function));
    expect(result.current.onSelectImportBatch).toEqual(expect.any(Function));
    expect(result.current.onCloseImportBatchDetail).toEqual(expect.any(Function));
    expect(result.current.onToggleImportBatchItemSelection).toEqual(expect.any(Function));
    expect(result.current.onConfirmImportBatchItem).toEqual(expect.any(Function));
    expect(result.current.onConfirmSelectedImportBatchItems).toEqual(expect.any(Function));
    expect(result.current.onConfirmAllImportBatchItems).toEqual(expect.any(Function));
    expect(result.current.onSelectPrimaryAsset).toEqual(expect.any(Function));
    expect(result.current.onSelectAssetProvenance).toEqual(expect.any(Function));
    expect(result.current.onCloseAssetProvenance).toEqual(expect.any(Function));
  });

  it("wires monitor, detail, provenance, and confirm-selected flow through the composed hooks", async () => {
    loadAssetMonitorPanelMock
      .mockResolvedValueOnce(createAssetMonitor("project-live-001"))
      .mockResolvedValue(createAssetMonitor("project-live-001"));
    loadImportBatchDetailsMock
      .mockResolvedValueOnce(createAssetBatchDetail("project-live-001"))
      .mockResolvedValue(createAssetBatchDetail("project-live-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("project-live-001"),
    );
    confirmImportBatchItemsMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        enabled: true,
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
    expect(result.current.selectedImportBatchId).toBe("import-batch-1");

    act(() => {
      result.current.onSelectAssetProvenance("media-asset-1");
    });

    await waitFor(() => {
      expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
    });
    expect(result.current.selectedAssetProvenanceId).toBe("media-asset-1");

    act(() => {
      result.current.onToggleImportBatchItemSelection({ itemId: "import-item-1", checked: true });
      result.current.onConfirmSelectedImportBatchItems({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-1"],
      });
    });

    await waitFor(() => {
      expect(result.current.assetActionFeedback?.tone).toBe("success");
    });

    expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-1"],
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(result.current.selectedImportItemIds).toEqual([]);
    expect(result.current.importBatchDetail?.batch.id).toBe("import-batch-1");
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("media-asset-1");
  });

  it("does not load asset monitor or details when the asset route is disabled", async () => {
    const { result } = renderHook(() =>
      useAdminAssetController({
        sessionState: "ready",
        enabled: false,
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toEqual([]);
    });

    expect(loadAssetMonitorPanelMock).not.toHaveBeenCalled();
    expect(loadImportBatchDetailsMock).not.toHaveBeenCalled();
    expect(loadAssetProvenanceDetailsMock).not.toHaveBeenCalled();
  });
});
