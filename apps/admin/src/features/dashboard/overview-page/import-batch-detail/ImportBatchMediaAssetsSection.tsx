import type { AdminTranslator } from "../../../../i18n";
import type { ImportBatchMediaAssetViewModel } from "../../assetMonitor";
import { metricStyle } from "../shared";

export function ImportBatchMediaAssetsSection({
  mediaAssets,
  onSelectAssetProvenance,
  t,
}: {
  mediaAssets: ImportBatchMediaAssetViewModel[];
  onSelectAssetProvenance?: (assetId: string) => void;
  t: AdminTranslator;
}) {
  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <h3 style={{ margin: 0 }}>{t("asset.detail.mediaAssets")}</h3>
      {mediaAssets.map((asset) => (
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
  );
}
