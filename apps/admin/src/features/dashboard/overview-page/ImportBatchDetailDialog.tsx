import { useId, useRef } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { ImportBatchDetailViewModel } from "../assetMonitor";
import {
  actionButtonBaseStyle,
  actionButtonToneStyles,
  getFeedbackPalette,
  metricStyle,
  type FeedbackMessage,
} from "./shared";
import { useDialogAccessibility } from "./useDialogAccessibility";
import { ImportBatchCandidateAssetsSection } from "./import-batch-detail/ImportBatchCandidateAssetsSection";
import { ImportBatchItemsSection } from "./import-batch-detail/ImportBatchItemsSection";
import { ImportBatchMediaAssetsSection } from "./import-batch-detail/ImportBatchMediaAssetsSection";
import { ImportBatchMetadataSection } from "./import-batch-detail/ImportBatchMetadataSection";
import { ImportBatchUploadSessionsSection } from "./import-batch-detail/ImportBatchUploadSessionsSection";
import { deriveImportBatchSelections } from "./import-batch-detail/helpers";

export function ImportBatchDetailDialog({
  importBatchDetail,
  selectedImportItemIds = [],
  assetActionFeedback,
  assetActionPending,
  onToggleImportBatchItemSelection,
  onConfirmImportBatchItem,
  onConfirmSelectedImportBatchItems,
  onConfirmAllImportBatchItems,
  onSelectPrimaryAsset,
  onSelectAssetProvenance,
  onCloseImportBatchDetail,
  t,
}: {
  importBatchDetail: ImportBatchDetailViewModel;
  selectedImportItemIds?: string[];
  assetActionFeedback?: FeedbackMessage;
  assetActionPending?: boolean;
  onToggleImportBatchItemSelection?: (input: { itemId: string; checked: boolean }) => void;
  onConfirmImportBatchItem?: (input: { importBatchId: string; itemId: string }) => void;
  onConfirmSelectedImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onConfirmAllImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onSelectPrimaryAsset?: (input: { shotExecutionId: string; assetId: string }) => void;
  onSelectAssetProvenance?: (assetId: string) => void;
  onCloseImportBatchDetail?: () => void;
  t: AdminTranslator;
}) {
  const assetDetailTitleId = useId();
  const assetDetailDialogRef = useRef<HTMLElement | null>(null);
  const assetDetailCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const derivedSelections = deriveImportBatchSelections(
    importBatchDetail,
    selectedImportItemIds,
  );

  useDialogAccessibility({
    open: true,
    dialogRef: assetDetailDialogRef,
    closeButtonRef: assetDetailCloseButtonRef,
    onClose: onCloseImportBatchDetail,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={assetDetailTitleId}
        ref={assetDetailDialogRef}
        tabIndex={-1}
        style={{
          width: "min(900px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          borderRadius: "24px",
          padding: "24px",
          background: "#f8fafc",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.2)",
          display: "grid",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <h2 id={assetDetailTitleId} style={{ margin: 0 }}>
              {t("asset.detail.title")}
            </h2>
            <p style={metricStyle}>{importBatchDetail.batch.id}</p>
          </div>
          <button
            type="button"
            ref={assetDetailCloseButtonRef}
            aria-label={t("asset.detail.close")}
            onClick={() => {
              onCloseImportBatchDetail?.();
            }}
            style={{
              ...actionButtonBaseStyle,
              ...actionButtonToneStyles.close,
            }}
          >
            {t("asset.detail.close")}
          </button>
        </div>
        {assetActionFeedback ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              ...getFeedbackPalette(assetActionFeedback),
            }}
          >
            {assetActionFeedback.message}
          </p>
        ) : null}
        <ImportBatchMetadataSection importBatchDetail={importBatchDetail} t={t} />
        <ImportBatchUploadSessionsSection importBatchDetail={importBatchDetail} t={t} />
        <ImportBatchItemsSection
          importBatchDetail={importBatchDetail}
          selectedImportItemIds={selectedImportItemIds}
          derivedSelections={derivedSelections}
          assetActionPending={assetActionPending}
          onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
          onConfirmImportBatchItem={onConfirmImportBatchItem}
          onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
          onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
          t={t}
        />
        <ImportBatchCandidateAssetsSection
          candidateAssets={importBatchDetail.candidateAssets}
          assetActionPending={assetActionPending}
          onSelectPrimaryAsset={onSelectPrimaryAsset}
          onSelectAssetProvenance={onSelectAssetProvenance}
          t={t}
        />
        <ImportBatchMediaAssetsSection
          mediaAssets={importBatchDetail.mediaAssets}
          onSelectAssetProvenance={onSelectAssetProvenance}
          t={t}
        />
      </aside>
    </div>
  );
}
