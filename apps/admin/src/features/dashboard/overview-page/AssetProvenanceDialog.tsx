import { useId, useRef } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { AssetProvenanceDetailViewModel } from "../assetMonitor";
import { actionButtonBaseStyle, actionButtonToneStyles, metricStyle } from "./shared";
import { useDialogAccessibility } from "./useDialogAccessibility";

export function AssetProvenanceDialog({
  assetProvenanceDetail,
  onCloseAssetProvenance,
  t,
}: {
  assetProvenanceDetail: AssetProvenanceDetailViewModel;
  onCloseAssetProvenance?: () => void;
  t: AdminTranslator;
}) {
  const assetProvenanceTitleId = useId();
  const assetProvenanceDialogRef = useRef<HTMLElement | null>(null);
  const assetProvenanceCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useDialogAccessibility({
    open: true,
    dialogRef: assetProvenanceDialogRef,
    closeButtonRef: assetProvenanceCloseButtonRef,
    onClose: onCloseAssetProvenance,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={assetProvenanceTitleId}
        ref={assetProvenanceDialogRef}
        tabIndex={-1}
        style={{
          width: "min(720px, 100%)",
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
            <h2 id={assetProvenanceTitleId} style={{ margin: 0 }}>
              {t("asset.provenance.title")}
            </h2>
            <p style={metricStyle}>{assetProvenanceDetail.asset.id}</p>
          </div>
          <button
            type="button"
            ref={assetProvenanceCloseButtonRef}
            aria-label={t("asset.provenance.close")}
            onClick={() => {
              onCloseAssetProvenance?.();
            }}
            style={{
              ...actionButtonBaseStyle,
              ...actionButtonToneStyles.close,
            }}
          >
            {t("asset.provenance.close")}
          </button>
        </div>
        <p style={metricStyle}>{assetProvenanceDetail.provenanceSummary}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <p style={metricStyle}>
            {t("asset.provenance.candidateAssetId", {
              candidateAssetId: assetProvenanceDetail.candidateAssetId || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.provenance.shotExecutionId", {
              shotExecutionId: assetProvenanceDetail.shotExecutionId || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.provenance.sourceRunId", {
              sourceRunId: assetProvenanceDetail.sourceRunId || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.provenance.importBatchId", {
              importBatchId: assetProvenanceDetail.importBatchId || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.provenance.variantCount", {
              variantCount: assetProvenanceDetail.variantCount,
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.provenance.assetMeta", {
              sourceType: assetProvenanceDetail.asset.sourceType,
              rightsStatus: assetProvenanceDetail.asset.rightsStatus,
              consentStatus: assetProvenanceDetail.asset.consentStatus,
              locale: assetProvenanceDetail.asset.locale || "none",
              aiAnnotated: assetProvenanceDetail.asset.aiAnnotated ? "true" : "false",
            })}
          </p>
        </div>
      </aside>
    </div>
  );
}
