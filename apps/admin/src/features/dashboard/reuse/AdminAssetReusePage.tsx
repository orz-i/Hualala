import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { AssetProvenanceDetailViewModel } from "../assetMonitor";
import { AssetProvenanceDialog } from "../overview-page/AssetProvenanceDialog";
import type { AdminAssetReuseAuditViewModel } from "./adminAssetReuse";

const panelStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "#ffffff",
  padding: "20px",
  display: "grid",
  gap: "14px",
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)",
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: "999px",
  padding: "10px 18px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
};

export function AdminAssetReusePage({
  audit,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: {
  audit: AdminAssetReuseAuditViewModel;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  t: AdminTranslator;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
}) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("reuse.panel.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.shotExecutionId", { shotExecutionId: audit.shotExecution.id })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.sourceProjectId", {
              projectId: audit.summary.sourceProjectId || "none",
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.primaryAssetId", {
              assetId: audit.shotExecution.primaryAssetId || "none",
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.eligibility", {
              status: audit.summary.isEligible
                ? t("reuse.summary.eligible")
                : t("reuse.summary.blocked"),
            })}
          </p>
          {audit.summary.blockedReason ? (
            <p style={{ margin: 0, color: "#991b1b" }}>{audit.summary.blockedReason}</p>
          ) : null}
          {assetProvenancePending ? (
            <p style={{ margin: 0, color: "#475569" }}>{t("asset.provenance.open")}</p>
          ) : null}
          {assetProvenanceErrorMessage ? (
            <p style={{ margin: 0, color: "#991b1b" }}>{assetProvenanceErrorMessage}</p>
          ) : null}
        </div>
      </article>

      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("reuse.audit.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("reuse.audit.description")}</p>
        </div>
        <div style={{ display: "grid", gap: "8px", color: "#475569" }}>
          <p style={{ margin: 0 }}>
            {t("reuse.audit.crossProject", {
              status: audit.summary.isCrossProject
                ? t("reuse.summary.eligible")
                : t("reuse.summary.blocked"),
            })}
          </p>
          {audit.assetProvenanceDetail ? (
            <p style={{ margin: 0 }}>
              {t("reuse.audit.assetPolicy", {
                rightsStatus: audit.assetProvenanceDetail.asset.rightsStatus || "unknown",
                consentStatus: audit.assetProvenanceDetail.asset.consentStatus || "unknown",
                aiAnnotated: audit.assetProvenanceDetail.asset.aiAnnotated ? "true" : "false",
              })}
            </p>
          ) : null}
          <p style={{ margin: 0 }}>
            {t("reuse.audit.provenanceSummary", {
              summary: audit.assetProvenanceDetail?.provenanceSummary || "none",
            })}
          </p>
        </div>
        <div>
          <button
            type="button"
            disabled={!audit.shotExecution.primaryAssetId}
            onClick={() => {
              if (!audit.shotExecution.primaryAssetId) {
                return;
              }
              onOpenAssetProvenance(audit.shotExecution.primaryAssetId);
            }}
            style={{
              ...buttonStyle,
              opacity: audit.shotExecution.primaryAssetId ? 1 : 0.45,
              cursor: audit.shotExecution.primaryAssetId ? "pointer" : "not-allowed",
            }}
          >
            {t("asset.provenance.open")}
          </button>
        </div>
      </article>

      {assetProvenanceDetail ? (
        <AssetProvenanceDialog
          assetProvenanceDetail={assetProvenanceDetail}
          onCloseAssetProvenance={onCloseAssetProvenance}
          t={t}
        />
      ) : null}
    </section>
  );
}
