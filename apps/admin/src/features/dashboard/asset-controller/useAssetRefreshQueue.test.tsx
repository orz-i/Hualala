import { act, renderHook, waitFor } from "@testing-library/react";
import { useAssetRefreshQueue } from "./useAssetRefreshQueue";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}

describe("useAssetRefreshQueue", () => {
  it("queues at most one extra silent refresh while a refresh is already running", async () => {
    const firstMonitorRefresh = createDeferred();
    const refreshAssetMonitor = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstMonitorRefresh.promise)
      .mockResolvedValue(undefined);
    const refreshImportBatchDetail = vi.fn<(importBatchId: string) => Promise<void>>().mockResolvedValue(
      undefined,
    );
    const refreshAssetProvenanceDetail = vi
      .fn<(assetId: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAssetRefreshQueue({
        refreshAssetMonitor,
        refreshImportBatchDetail,
        refreshAssetProvenanceDetail,
        selectedImportBatchId: "import-batch-1",
        selectedAssetProvenanceId: "media-asset-1",
      }),
    );

    const firstCall = result.current.refreshAssetSilently();
    const secondCall = result.current.refreshAssetSilently();
    const thirdCall = result.current.refreshAssetSilently();

    await waitFor(() => {
      expect(refreshAssetMonitor).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      firstMonitorRefresh.resolve();
      await Promise.all([firstCall, secondCall, thirdCall]);
    });

    await waitFor(() => {
      expect(refreshAssetMonitor).toHaveBeenCalledTimes(2);
    });

    expect(refreshImportBatchDetail).toHaveBeenCalledTimes(2);
    expect(refreshImportBatchDetail).toHaveBeenCalledWith("import-batch-1");
    expect(refreshAssetProvenanceDetail).toHaveBeenCalledTimes(2);
    expect(refreshAssetProvenanceDetail).toHaveBeenCalledWith("media-asset-1");
  });
});
