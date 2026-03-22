import { useId, useRef } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { ImportBatchDetailViewModel } from "../assetMonitor";
import {
  actionButtonBaseStyle,
  actionButtonToneStyles,
  formatFileSize,
  getFeedbackPalette,
  metricStyle,
  type FeedbackMessage,
} from "./shared";
import { useDialogAccessibility } from "./useDialogAccessibility";

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
  const actionableImportItems = importBatchDetail.items.filter(
    (item) => item.status !== "confirmed" && Boolean(item.assetId),
  );
  const actionableImportItemIds = actionableImportItems.map((item) => item.id);
  const selectedActionableImportItemIds = selectedImportItemIds.filter((itemId) =>
    actionableImportItemIds.includes(itemId),
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <p style={metricStyle}>
            {t("asset.detail.project", { projectId: importBatchDetail.batch.projectId })}
          </p>
          <p style={metricStyle}>
            {t("asset.detail.org", { orgId: importBatchDetail.batch.orgId })}
          </p>
          <p style={metricStyle}>
            {t("asset.detail.operator", { operatorId: importBatchDetail.batch.operatorId })}
          </p>
          <p style={metricStyle}>
            {t("asset.detail.sourceType", { sourceType: importBatchDetail.batch.sourceType })}
          </p>
          <p style={metricStyle}>
            {t("asset.detail.status", { status: importBatchDetail.batch.status })}
          </p>
          <p style={metricStyle}>
            {t("asset.detail.section.summary", {
              uploadSessionCount: importBatchDetail.uploadSessions.length,
              itemCount: importBatchDetail.items.length,
              candidateAssetCount: importBatchDetail.candidateAssets.length,
              mediaAssetCount: importBatchDetail.mediaAssets.length,
            })}
          </p>
        </div>

        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>{t("asset.detail.uploadSessions")}</h3>
          {importBatchDetail.uploadSessions.map((session) => (
            <article
              key={session.id}
              style={{
                display: "grid",
                gap: "6px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <strong>{session.fileName || session.id}</strong>
              <p style={metricStyle}>
                {t("asset.uploadSession.summary", {
                  status: session.status,
                  size: formatFileSize(session.sizeBytes),
                  retryCount: session.retryCount,
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.uploadSession.checksum", { checksum: session.checksum || "none" })}
              </p>
            </article>
          ))}
        </section>

        <section style={{ display: "grid", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: "6px" }}>
              <h3 style={{ margin: 0 }}>{t("asset.detail.items")}</h3>
              <p style={metricStyle}>
                {t("asset.action.selection.summary", {
                  selectedCount: selectedActionableImportItemIds.length,
                  actionableCount: actionableImportItemIds.length,
                })}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={Boolean(assetActionPending) || selectedActionableImportItemIds.length === 0}
                onClick={() => {
                  onConfirmSelectedImportBatchItems?.({
                    importBatchId: importBatchDetail.batch.id,
                    itemIds: selectedActionableImportItemIds,
                  });
                }}
                style={{
                  ...actionButtonBaseStyle,
                  ...(assetActionPending || selectedActionableImportItemIds.length === 0
                    ? actionButtonToneStyles.pending
                    : actionButtonToneStyles.confirm),
                }}
              >
                {t("asset.action.confirmSelected.button")}
              </button>
              <button
                type="button"
                disabled={Boolean(assetActionPending) || actionableImportItemIds.length === 0}
                onClick={() => {
                  onConfirmAllImportBatchItems?.({
                    importBatchId: importBatchDetail.batch.id,
                    itemIds: actionableImportItemIds,
                  });
                }}
                style={{
                  ...actionButtonBaseStyle,
                  ...(assetActionPending || actionableImportItemIds.length === 0
                    ? actionButtonToneStyles.pending
                    : actionButtonToneStyles.confirm),
                }}
              >
                {t("asset.action.confirmAll.button")}
              </button>
            </div>
          </div>
          {importBatchDetail.items.map((item) => (
            <article
              key={item.id}
              style={{
                display: "grid",
                gap: "6px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <strong>{item.id}</strong>
              <p style={metricStyle}>
                {t("asset.item.summary", { status: item.status, assetId: item.assetId || "none" })}
              </p>
              {item.status !== "confirmed" && item.assetId ? (
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#334155",
                      fontSize: "0.95rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={t("asset.action.selection.item", { itemId: item.id })}
                      checked={selectedImportItemIds.includes(item.id)}
                      disabled={Boolean(assetActionPending)}
                      onChange={(event) => {
                        onToggleImportBatchItemSelection?.({
                          itemId: item.id,
                          checked: event.currentTarget.checked,
                        });
                      }}
                    />
                    {t("asset.action.selection.label")}
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(assetActionPending)}
                    aria-label={t("asset.action.confirm.buttonLabel", { itemId: item.id })}
                    onClick={() => {
                      onConfirmImportBatchItem?.({
                        importBatchId: importBatchDetail.batch.id,
                        itemId: item.id,
                      });
                    }}
                    style={{
                      ...actionButtonBaseStyle,
                      ...(assetActionPending
                        ? actionButtonToneStyles.pending
                        : actionButtonToneStyles.confirm),
                    }}
                  >
                    {t("asset.action.confirm.button")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>{t("asset.detail.candidateAssets")}</h3>
          {importBatchDetail.candidateAssets.map((candidate) => (
            <article
              key={candidate.id}
              style={{
                display: "grid",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <strong>{candidate.id}</strong>
              <p style={metricStyle}>
                {t("asset.candidate.summary", {
                  shotExecutionId: candidate.shotExecutionId || "none",
                  sourceRunId: candidate.sourceRunId || "none",
                })}
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={metricStyle}>
                  {t("asset.candidate.assetId", { assetId: candidate.assetId || "none" })}
                </span>
                {candidate.assetId ? (
                  <>
                    <button
                      type="button"
                      aria-label={t("asset.provenance.button", { assetId: candidate.assetId })}
                      onClick={() => {
                        onSelectAssetProvenance?.(candidate.assetId);
                      }}
                      style={{
                        border: 0,
                        borderRadius: "999px",
                        padding: "8px 14px",
                        background: "#0f766e",
                        color: "#ecfeff",
                        cursor: "pointer",
                      }}
                    >
                      {t("asset.provenance.open")}
                    </button>
                    {candidate.shotExecutionId ? (
                      <button
                        type="button"
                        disabled={Boolean(assetActionPending)}
                        aria-label={t("asset.action.selectPrimary.buttonLabel", {
                          candidateId: candidate.id,
                        })}
                        onClick={() => {
                          onSelectPrimaryAsset?.({
                            shotExecutionId: candidate.shotExecutionId,
                            assetId: candidate.assetId,
                          });
                        }}
                        style={{
                          ...actionButtonBaseStyle,
                          ...(assetActionPending
                            ? actionButtonToneStyles.pending
                            : actionButtonToneStyles.primary),
                        }}
                      >
                        {t("asset.action.selectPrimary.button")}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>{t("asset.detail.mediaAssets")}</h3>
          {importBatchDetail.mediaAssets.map((asset) => (
            <article
              key={asset.id}
              style={{
                display: "grid",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <strong>{asset.id}</strong>
              <p style={metricStyle}>
                {t("asset.media.summary", {
                  sourceType: asset.sourceType,
                  rightsStatus: asset.rightsStatus,
                  locale: asset.locale || "none",
                })}
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={metricStyle}>
                  {t("asset.media.importBatchId", {
                    importBatchId: asset.importBatchId || "none",
                  })}
                </span>
                <button
                  type="button"
                  aria-label={t("asset.provenance.button", { assetId: asset.id })}
                  onClick={() => {
                    onSelectAssetProvenance?.(asset.id);
                  }}
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "8px 14px",
                    background: "#0f766e",
                    color: "#ecfeff",
                    cursor: "pointer",
                  }}
                >
                  {t("asset.provenance.open")}
                </button>
              </div>
            </article>
          ))}
        </section>
      </aside>
    </div>
  );
}
