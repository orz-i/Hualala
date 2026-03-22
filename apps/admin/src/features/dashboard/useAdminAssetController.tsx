import type { AdminTranslator } from "../../i18n";
import { useAssetActions } from "./asset-controller/useAssetActions";
import { useAssetDetailState } from "./asset-controller/useAssetDetailState";
import { useAssetMonitorState } from "./asset-controller/useAssetMonitorState";
import { useAssetRefreshQueue } from "./asset-controller/useAssetRefreshQueue";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

export function useAdminAssetController({
  sessionState,
  projectId,
  identityOverride,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  identityOverride: IdentityOverride;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const monitorState = useAssetMonitorState({
    sessionState,
    projectId,
    identityOverride,
  });
  const detailState = useAssetDetailState({
    sessionState,
    identityOverride,
  });
  const refreshQueue = useAssetRefreshQueue({
    refreshAssetMonitor: monitorState.refreshAssetMonitor,
    refreshImportBatchDetail: detailState.refreshImportBatchDetail,
    refreshAssetProvenanceDetail: detailState.refreshAssetProvenanceDetail,
    selectedImportBatchId: detailState.selectedImportBatchId,
    selectedAssetProvenanceId: detailState.selectedAssetProvenanceId,
  });
  const assetActions = useAssetActions({
    effectiveOrgId,
    effectiveUserId,
    refreshAssetSilently: refreshQueue.refreshAssetSilently,
    clearSelectedImportItemIds: detailState.clearSelectedImportItemIds,
    t,
  });

  return {
    assetMonitor: monitorState.assetMonitor,
    importBatchDetail: detailState.importBatchDetail,
    assetProvenanceDetail: detailState.assetProvenanceDetail,
    selectedImportItemIds: detailState.selectedImportItemIds,
    assetActionFeedback: assetActions.assetActionFeedback,
    assetActionPending: assetActions.assetActionPending,
    refreshAssetSilently: refreshQueue.refreshAssetSilently,
    onAssetStatusFilterChange: monitorState.onAssetStatusFilterChange,
    onAssetSourceTypeFilterChange: monitorState.onAssetSourceTypeFilterChange,
    onSelectImportBatch: (importBatchId: string) => {
      assetActions.resetAssetActionState();
      detailState.onSelectImportBatch(importBatchId);
    },
    onCloseImportBatchDetail: () => {
      assetActions.resetAssetActionState();
      detailState.onCloseImportBatchDetail();
    },
    onToggleImportBatchItemSelection: detailState.onToggleImportBatchItemSelection,
    onConfirmImportBatchItem: assetActions.onConfirmImportBatchItem,
    onConfirmSelectedImportBatchItems: assetActions.onConfirmSelectedImportBatchItems,
    onConfirmAllImportBatchItems: assetActions.onConfirmAllImportBatchItems,
    onSelectPrimaryAsset: assetActions.onSelectPrimaryAsset,
    onSelectAssetProvenance: detailState.onSelectAssetProvenance,
    onCloseAssetProvenance: detailState.onCloseAssetProvenance,
  };
}
