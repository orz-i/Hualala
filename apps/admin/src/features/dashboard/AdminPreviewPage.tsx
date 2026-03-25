import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminPreviewItemViewModel, AdminPreviewWorkbenchViewModel } from "./adminPreview";
import type { AdminPreviewRuntimeViewModel } from "./adminPreviewRuntime";
import { AssetProvenanceDialog } from "./overview-page/AssetProvenanceDialog";

type AdminPreviewPageProps = {
  previewWorkbench: AdminPreviewWorkbenchViewModel;
  previewRuntime: AdminPreviewRuntimeViewModel | null;
  runtimeErrorMessage: string;
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

function formatShotIdentity(item: AdminPreviewItemViewModel, t: AdminTranslator) {
  if (!item.shotSummary) {
    return item.shotId || t("preview.item.metadataUnavailable");
  }

  const sceneSegment = item.shotSummary.sceneCode || item.shotSummary.sceneId || item.shotId;
  const shotSegment = item.shotSummary.shotCode || item.shotSummary.shotId || item.shotId;
  return `${sceneSegment} / ${shotSegment}`;
}

function formatShotTitle(item: AdminPreviewItemViewModel, t: AdminTranslator) {
  if (!item.shotSummary) {
    return t("preview.item.metadataUnavailable");
  }

  const sceneTitle = item.shotSummary.sceneTitle || item.shotSummary.sceneCode || item.shotSummary.sceneId;
  const shotTitle = item.shotSummary.shotTitle || item.shotSummary.shotCode || item.shotSummary.shotId;
  return `${sceneTitle} / ${shotTitle}`;
}

function formatPrimaryAssetSummary(item: AdminPreviewItemViewModel, t: AdminTranslator) {
  if (item.primaryAssetSummary) {
    return `${item.primaryAssetSummary.mediaType || "asset"} · ${item.primaryAssetSummary.rightsStatus || "unknown"} · ${item.primaryAssetSummary.aiAnnotated ? "AI annotated" : "Human curated"}`;
  }
  if (item.primaryAssetId) {
    return t("preview.item.primaryAssetId", { primaryAssetId: item.primaryAssetId });
  }
  return t("preview.item.primaryAssetMissing");
}

function formatSourceRunSummary(item: AdminPreviewItemViewModel, t: AdminTranslator) {
  if (item.sourceRunSummary) {
    return `${item.sourceRunSummary.status || "unknown"} · ${item.sourceRunSummary.triggerType || "unknown"}`;
  }
  if (item.sourceRunId) {
    return t("preview.item.sourceRunId", { sourceRunId: item.sourceRunId });
  }
  return t("preview.item.metadataUnavailable");
}

function formatRuntimeField(value: string, fallback: string) {
  return value || fallback;
}

export function AdminPreviewPage({
  previewWorkbench,
  previewRuntime,
  runtimeErrorMessage,
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
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.missingSourceRunCount", {
              count: previewWorkbench.summary.missingSourceRunCount,
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
          <h2 style={{ margin: 0 }}>{t("preview.runtime.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("preview.runtime.description")}</p>
        </div>
        {previewRuntime ? (
          <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.status", {
                status: formatRuntimeField(
                  previewRuntime.status,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.renderStatus", {
                status: formatRuntimeField(
                  previewRuntime.renderStatus,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.workflowRunId", {
                workflowRunId: formatRuntimeField(
                  previewRuntime.renderWorkflowRunId,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.resolvedLocale", {
                locale: formatRuntimeField(
                  previewRuntime.resolvedLocale,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.playbackAssetId", {
                assetId: formatRuntimeField(
                  previewRuntime.playbackAssetId,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.exportAssetId", {
                assetId: formatRuntimeField(
                  previewRuntime.exportAssetId,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("preview.runtime.updatedAt", {
                updatedAt: formatRuntimeField(
                  previewRuntime.updatedAt,
                  t("preview.runtime.emptyValue"),
                ),
              })}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>{t("preview.runtime.empty")}</p>
        )}
        {runtimeErrorMessage ? (
          <p style={{ margin: 0, color: "#991b1b" }}>{runtimeErrorMessage}</p>
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
                data-testid={`admin-preview-item-${item.itemId}`}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <strong>{t("preview.item.sequence", { sequence: item.sequence })}</strong>
                <span style={{ color: "#475569" }}>{formatShotIdentity(item, t)}</span>
                <span style={{ color: "#475569" }}>{formatShotTitle(item, t)}</span>
                <span style={{ color: "#475569" }}>{formatPrimaryAssetSummary(item, t)}</span>
                <span style={{ color: "#475569" }}>{formatSourceRunSummary(item, t)}</span>
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
