import { useId, useRef } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetProvenance";
import { useDialogAccessibility } from "./useDialogAccessibility";

type AssetProvenanceDialogProps = {
  assetProvenanceDetail?: AssetProvenanceDetailViewModel | null;
  assetProvenancePending?: boolean;
  assetProvenanceErrorMessage?: string;
  onCloseAssetProvenance?: () => void;
  t: CreatorTranslator;
};

const metricStyle = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#475569",
};

export function AssetProvenanceDialog({
  assetProvenanceDetail,
  assetProvenancePending = false,
  assetProvenanceErrorMessage,
  onCloseAssetProvenance,
  t,
}: AssetProvenanceDialogProps) {
  const open = Boolean(assetProvenanceDetail) || assetProvenancePending || Boolean(assetProvenanceErrorMessage);
  const assetProvenanceTitleId = useId();
  const assetProvenanceDialogRef = useRef<HTMLElement | null>(null);
  const assetProvenanceCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useDialogAccessibility({
    open,
    dialogRef: assetProvenanceDialogRef,
    closeButtonRef: assetProvenanceCloseButtonRef,
    onClose: onCloseAssetProvenance,
  });

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        zIndex: 10,
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
            {assetProvenanceDetail ? (
              <p style={metricStyle}>{assetProvenanceDetail.asset.id}</p>
            ) : null}
          </div>
          <button
            type="button"
            ref={assetProvenanceCloseButtonRef}
            aria-label={t("asset.provenance.close")}
            onClick={() => {
              onCloseAssetProvenance?.();
            }}
            style={{
              borderRadius: "999px",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              padding: "10px 16px",
              background: "#ffffff",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            {t("asset.provenance.close")}
          </button>
        </div>
        {assetProvenancePending ? (
          <p style={metricStyle}>{t("asset.provenance.loading")}</p>
        ) : null}
        {assetProvenanceErrorMessage ? (
          <p style={{ ...metricStyle, color: "#991b1b" }}>{assetProvenanceErrorMessage}</p>
        ) : null}
        {assetProvenanceDetail ? (
          <>
            <p style={metricStyle}>
              {assetProvenanceDetail.provenanceSummary || t("asset.provenance.none")}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <p style={metricStyle}>
                {t("asset.provenance.candidateAssetId", {
                  candidateAssetId:
                    assetProvenanceDetail.candidateAssetId || t("asset.provenance.none"),
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.shotExecutionId", {
                  shotExecutionId:
                    assetProvenanceDetail.shotExecutionId || t("asset.provenance.none"),
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.sourceRunId", {
                  sourceRunId:
                    assetProvenanceDetail.sourceRunId || t("asset.provenance.none"),
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.importBatchId", {
                  importBatchId:
                    assetProvenanceDetail.importBatchId || t("asset.provenance.none"),
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
                  locale: assetProvenanceDetail.asset.locale || t("asset.provenance.none"),
                  aiAnnotated: assetProvenanceDetail.asset.aiAnnotated ? "true" : "false",
                })}
              </p>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
