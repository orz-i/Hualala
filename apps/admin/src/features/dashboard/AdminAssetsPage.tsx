import type { AdminTranslator } from "../../i18n";
import type {
  AssetMonitorViewModel,
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "./assetMonitor";
import { AssetMonitorPanel } from "./overview-page/AssetMonitorPanel";
import { AssetProvenanceDialog } from "./overview-page/AssetProvenanceDialog";
import { ImportBatchDetailDialog } from "./overview-page/ImportBatchDetailDialog";
import { panelStyle, type FeedbackMessage } from "./overview-page/shared";

export function AdminAssetsPage({
  assetMonitor,
  importBatchDetail,
  assetProvenanceDetail,
  selectedImportItemIds = [],
  assetActionFeedback,
  assetActionPending,
  t,
  onAssetStatusFilterChange,
  onAssetSourceTypeFilterChange,
  onSelectImportBatch,
  onCloseImportBatchDetail,
  onToggleImportBatchItemSelection,
  onConfirmImportBatchItem,
  onConfirmSelectedImportBatchItems,
  onConfirmAllImportBatchItems,
  onSelectPrimaryAsset,
  onSelectAssetProvenance,
  onCloseAssetProvenance,
}: {
  assetMonitor: AssetMonitorViewModel;
  importBatchDetail?: ImportBatchDetailViewModel | null;
  assetProvenanceDetail?: AssetProvenanceDetailViewModel | null;
  selectedImportItemIds?: string[];
  assetActionFeedback?: FeedbackMessage;
  assetActionPending?: boolean;
  t: AdminTranslator;
  onAssetStatusFilterChange?: (status: string) => void;
  onAssetSourceTypeFilterChange?: (sourceType: string) => void;
  onSelectImportBatch?: (importBatchId: string) => void;
  onCloseImportBatchDetail?: () => void;
  onToggleImportBatchItemSelection?: (input: { itemId: string; checked: boolean }) => void;
  onConfirmImportBatchItem?: (input: { importBatchId: string; itemId: string }) => void;
  onConfirmSelectedImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onConfirmAllImportBatchItems?: (input: { importBatchId: string; itemIds: string[] }) => void;
  onSelectPrimaryAsset?: (input: { shotExecutionId: string; assetId: string }) => void;
  onSelectAssetProvenance?: (assetId: string) => void;
  onCloseAssetProvenance?: () => void;
}) {
  return (
    <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.5rem" }}>
          {t("asset.panel.title")}
        </h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("asset.panel.summary", { count: assetMonitor.importBatches.length })}
        </p>
      </section>

      <AssetMonitorPanel
        assetMonitor={assetMonitor}
        t={t}
        onAssetStatusFilterChange={onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
        onSelectImportBatch={onSelectImportBatch}
      />

      {importBatchDetail && !assetProvenanceDetail ? (
        <ImportBatchDetailDialog
          importBatchDetail={importBatchDetail}
          selectedImportItemIds={selectedImportItemIds}
          assetActionFeedback={assetActionFeedback}
          assetActionPending={assetActionPending}
          onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
          onConfirmImportBatchItem={onConfirmImportBatchItem}
          onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
          onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
          onSelectPrimaryAsset={onSelectPrimaryAsset}
          onSelectAssetProvenance={onSelectAssetProvenance}
          onCloseImportBatchDetail={onCloseImportBatchDetail}
          t={t}
        />
      ) : null}

      {assetProvenanceDetail ? (
        <AssetProvenanceDialog
          assetProvenanceDetail={assetProvenanceDetail}
          onCloseAssetProvenance={onCloseAssetProvenance}
          t={t}
        />
      ) : null}
    </>
  );
}
