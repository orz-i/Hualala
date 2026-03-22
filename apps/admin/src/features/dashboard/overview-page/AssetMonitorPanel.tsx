import { useId } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { AssetMonitorViewModel } from "../assetMonitor";
import { formatDateTime, metricStyle, panelStyle } from "./shared";

export function AssetMonitorPanel({
  assetMonitor,
  t,
  onAssetStatusFilterChange,
  onAssetSourceTypeFilterChange,
  onSelectImportBatch,
}: {
  assetMonitor: AssetMonitorViewModel;
  t: AdminTranslator;
  onAssetStatusFilterChange?: (status: string) => void;
  onAssetSourceTypeFilterChange?: (sourceType: string) => void;
  onSelectImportBatch?: (importBatchId: string) => void;
}) {
  const statusFilterId = useId();
  const sourceTypeFilterId = useId();

  return (
    <article style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.05rem" }}>
            {t("asset.panel.title")}
          </h2>
          <p style={{ ...metricStyle, fontSize: "0.9rem" }}>
            {t("asset.panel.summary", { count: assetMonitor.importBatches.length })}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            flex: "1 1 360px",
          }}
        >
          <label
            htmlFor={statusFilterId}
            style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
          >
            <span>{t("asset.filter.status")}</span>
            <select
              id={statusFilterId}
              aria-label={t("asset.filter.status")}
              value={assetMonitor.filters.status}
              onChange={(event) => {
                onAssetStatusFilterChange?.(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "8px 10px",
                font: "inherit",
                background: "#ffffff",
              }}
            >
              <option value="">{t("asset.filter.option.all")}</option>
              <option value="pending_review">{t("asset.filter.option.pendingReview")}</option>
              <option value="matched_pending_confirm">
                {t("asset.filter.option.matchedPendingConfirm")}
              </option>
              <option value="confirmed">{t("asset.filter.option.confirmed")}</option>
            </select>
          </label>
          <label
            htmlFor={sourceTypeFilterId}
            style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
          >
            <span>{t("asset.filter.sourceType")}</span>
            <select
              id={sourceTypeFilterId}
              aria-label={t("asset.filter.sourceType")}
              value={assetMonitor.filters.sourceType}
              onChange={(event) => {
                onAssetSourceTypeFilterChange?.(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "8px 10px",
                font: "inherit",
                background: "#ffffff",
              }}
            >
              <option value="">{t("asset.filter.option.all")}</option>
              <option value="upload_session">upload_session</option>
              <option value="workflow_import">workflow_import</option>
              <option value="manual_upload">manual_upload</option>
            </select>
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        {assetMonitor.importBatches.map((batch) => (
          <article
            key={batch.id}
            style={{
              display: "grid",
              gap: "10px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(255, 255, 255, 0.82)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <strong>{batch.id}</strong>
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "8px 14px",
                  background: "#1d4ed8",
                  color: "#eff6ff",
                  cursor: "pointer",
                }}
                aria-label={t("asset.detail.button", { id: batch.id })}
                onClick={() => {
                  onSelectImportBatch?.(batch.id);
                }}
              >
                {t("asset.detail.open")}
              </button>
            </div>
            <p style={metricStyle}>
              {t("asset.batch.summary", {
                sourceType: batch.sourceType,
                status: batch.status,
              })}
            </p>
            <p style={metricStyle}>
              {t("asset.batch.counts", {
                uploadSessionCount: batch.uploadSessionCount,
                itemCount: batch.itemCount,
                confirmedItemCount: batch.confirmedItemCount,
                candidateAssetCount: batch.candidateAssetCount,
                mediaAssetCount: batch.mediaAssetCount,
              })}
            </p>
            <p style={metricStyle}>
              {t("asset.batch.updatedAt", {
                updatedAt: formatDateTime(batch.updatedAt),
              })}
            </p>
          </article>
        ))}
      </div>
    </article>
  );
}
