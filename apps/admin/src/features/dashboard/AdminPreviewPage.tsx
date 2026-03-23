import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminPreviewWorkbenchViewModel } from "./adminPreview";
import { AssetProvenanceDialog } from "./overview-page/AssetProvenanceDialog";

type AdminPreviewPageProps = {
  previewWorkbench: AdminPreviewWorkbenchViewModel;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  t: AdminTranslator;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
};

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

export function AdminPreviewPage({
  previewWorkbench,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: AdminPreviewPageProps) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("preview.panel.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.status", { status: previewWorkbench.assembly.status })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.itemCount", { count: previewWorkbench.summary.itemCount })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.missingPrimaryAssetCount", {
              count: previewWorkbench.summary.missingPrimaryAssetCount,
            })}
          </p>
        </div>
        {assetProvenancePending ? (
          <p style={{ margin: 0, color: "#475569" }}>{t("asset.provenance.open")}</p>
        ) : null}
        {assetProvenanceErrorMessage ? (
          <p style={{ margin: 0, color: "#991b1b" }}>{assetProvenanceErrorMessage}</p>
        ) : null}
      </article>

      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("preview.items.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("preview.items.readonly")}</p>
        </div>
        {previewWorkbench.items.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("preview.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {previewWorkbench.items.map((item) => (
              <article
                key={item.itemId}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <strong>{t("preview.item.sequence", { sequence: item.sequence })}</strong>
                <span style={{ color: "#475569" }}>
                  {t("preview.item.shotId", { shotId: item.shotId || "none" })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("preview.item.primaryAssetId", {
                    primaryAssetId: item.primaryAssetId || "none",
                  })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("preview.item.sourceRunId", { sourceRunId: item.sourceRunId || "none" })}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={!item.primaryAssetId}
                    onClick={() => {
                      if (!item.primaryAssetId) {
                        return;
                      }
                      onOpenAssetProvenance(item.primaryAssetId);
                    }}
                    style={{
                      ...buttonStyle,
                      opacity: item.primaryAssetId ? 1 : 0.45,
                      cursor: item.primaryAssetId ? "pointer" : "not-allowed",
                    }}
                  >
                    {t("asset.provenance.open")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
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
