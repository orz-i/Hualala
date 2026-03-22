import { useCallback, useRef } from "react";

export function useAssetRefreshQueue({
  refreshAssetMonitor,
  refreshImportBatchDetail,
  refreshAssetProvenanceDetail,
  selectedImportBatchId,
  selectedAssetProvenanceId,
}: {
  refreshAssetMonitor: () => Promise<void>;
  refreshImportBatchDetail: (importBatchId: string) => Promise<void>;
  refreshAssetProvenanceDetail: (assetId: string) => Promise<void>;
  selectedImportBatchId: string | null;
  selectedAssetProvenanceId: string | null;
}) {
  const assetRefreshStateRef = useRef({
    running: false,
    queued: false,
  });

  const refreshAssetSilently = useCallback(async () => {
    if (assetRefreshStateRef.current.running) {
      assetRefreshStateRef.current.queued = true;
      return;
    }

    assetRefreshStateRef.current.running = true;

    try {
      await refreshAssetMonitor();
      if (selectedImportBatchId) {
        await refreshImportBatchDetail(selectedImportBatchId);
      }
      if (selectedAssetProvenanceId) {
        await refreshAssetProvenanceDetail(selectedAssetProvenanceId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown asset refresh error";
      console.warn(message);
    } finally {
      assetRefreshStateRef.current.running = false;
      if (assetRefreshStateRef.current.queued) {
        assetRefreshStateRef.current.queued = false;
        void refreshAssetSilently();
      }
    }
  }, [
    refreshAssetMonitor,
    refreshAssetProvenanceDetail,
    refreshImportBatchDetail,
    selectedAssetProvenanceId,
    selectedImportBatchId,
  ]);

  return {
    refreshAssetSilently,
  };
}
