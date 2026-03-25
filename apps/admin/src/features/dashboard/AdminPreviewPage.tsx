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

type OutputLinkProps = {
  href: string;
  label: string;
  style: CSSProperties;
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

function formatRuntimeNumber(
  value: number,
  suffix: string,
  fallback: string,
  options?: { allowZero?: boolean },
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return fallback;
  }
  if (value === 0 && !options?.allowZero) {
    return fallback;
  }
  return `${value}${suffix}`;
}

function formatTimelineShot(
  shotCode: string,
  shotTitle: string,
  fallback: string,
) {
  const code = shotCode || fallback;
  const title = shotTitle || fallback;
  return `${code} / ${title}`;
}

function OutputLink({ href, label, style }: OutputLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        ...style,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label}
    </a>
  );
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
          <div style={{ display: "grid", gap: "16px" }}>
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

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>{t("preview.runtime.playback.title")}</strong>
              {previewRuntime.playback ? (
                <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
                  <p style={{ margin: 0 }}>
                    {t("preview.runtime.playback.deliveryMode", {
                      mode: formatRuntimeField(
                        previewRuntime.playback.deliveryMode,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("preview.runtime.playback.duration", {
                      duration: formatRuntimeNumber(
                        previewRuntime.playback.durationMs,
                        "ms",
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0, wordBreak: "break-all" }}>
                    {t("preview.runtime.playback.playbackUrlLabel", {
                      url: formatRuntimeField(
                        previewRuntime.playback.playbackUrl,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0, wordBreak: "break-all" }}>
                    {t("preview.runtime.playback.posterUrlLabel", {
                      url: formatRuntimeField(
                        previewRuntime.playback.posterUrl,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  {previewRuntime.playback.playbackUrl ? (
                    <OutputLink
                      href={previewRuntime.playback.playbackUrl}
                      label={t("preview.runtime.playback.open")}
                      style={buttonStyle}
                    />
                  ) : null}
                </div>
              ) : null}

              <strong>{t("preview.runtime.timeline.title")}</strong>
              {previewRuntime.playback ? (
                previewRuntime.playback.timeline ? (
                  <div style={{ display: "grid", gap: "10px", color: "#475569" }}>
                    <p style={{ margin: 0 }}>
                      {t("preview.runtime.timeline.segmentCount", {
                        count: previewRuntime.playback.timeline.segments.length,
                      })}
                    </p>
                    <p style={{ margin: 0 }}>
                      {t("preview.runtime.timeline.totalDuration", {
                        duration: formatRuntimeNumber(
                          previewRuntime.playback.timeline.totalDurationMs,
                          "ms",
                          t("preview.runtime.emptyValue"),
                        ),
                      })}
                    </p>
                    <div style={{ display: "grid", gap: "10px" }}>
                      {previewRuntime.playback.timeline.segments.map((segment) => (
                        <article
                          key={segment.segmentId || `${segment.sequence}-${segment.shotId}`}
                          style={{
                            borderRadius: "14px",
                            padding: "12px 14px",
                            background: "rgba(241, 245, 249, 0.9)",
                            display: "grid",
                            gap: "4px",
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.sequence", {
                              sequence: String(segment.sequence || 0),
                            })}
                          </p>
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.shot", {
                              shot: formatTimelineShot(
                                segment.shotCode,
                                segment.shotTitle,
                                t("preview.runtime.emptyValue"),
                              ),
                            })}
                          </p>
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.start", {
                              start: formatRuntimeNumber(
                                segment.startMs,
                                "ms",
                                t("preview.runtime.emptyValue"),
                                { allowZero: true },
                              ),
                            })}
                          </p>
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.duration", {
                              duration: formatRuntimeNumber(
                                segment.durationMs,
                                "ms",
                                t("preview.runtime.emptyValue"),
                              ),
                            })}
                          </p>
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.playbackAssetId", {
                              assetId: formatRuntimeField(
                                segment.playbackAssetId,
                                t("preview.runtime.emptyValue"),
                              ),
                            })}
                          </p>
                          <p style={{ margin: 0 }}>
                            {t("preview.runtime.timeline.sourceRunId", {
                              sourceRunId: formatRuntimeField(
                                segment.sourceRunId,
                                t("preview.runtime.emptyValue"),
                              ),
                            })}
                          </p>
                          {segment.transitionToNext ? (
                            <p style={{ margin: 0 }}>
                              {t("preview.runtime.timeline.transition", {
                                transition: `${segment.transitionToNext.transitionType || t("preview.runtime.emptyValue")} · ${formatRuntimeNumber(
                                  segment.transitionToNext.durationMs,
                                  "ms",
                                  t("preview.runtime.emptyValue"),
                                )}`,
                              })}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>
                    {t("preview.runtime.timeline.empty")}
                  </p>
                )
              ) : null}

              <strong>{t("preview.runtime.export.title")}</strong>
              {previewRuntime.exportOutput ? (
                <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
                  <p style={{ margin: 0 }}>
                    {t("preview.runtime.export.fileName", {
                      fileName: formatRuntimeField(
                        previewRuntime.exportOutput.fileName,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("preview.runtime.export.mimeType", {
                      mimeType: formatRuntimeField(
                        previewRuntime.exportOutput.mimeType,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("preview.runtime.export.sizeBytes", {
                      sizeBytes: formatRuntimeNumber(
                        previewRuntime.exportOutput.sizeBytes,
                        " B",
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0, wordBreak: "break-all" }}>
                    {t("preview.runtime.export.downloadUrlLabel", {
                      url: formatRuntimeField(
                        previewRuntime.exportOutput.downloadUrl,
                        t("preview.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  {previewRuntime.exportOutput.downloadUrl ? (
                    <OutputLink
                      href={previewRuntime.exportOutput.downloadUrl}
                      label={t("preview.runtime.export.open")}
                      style={buttonStyle}
                    />
                  ) : null}
                </div>
              ) : null}

              {!previewRuntime.playback && !previewRuntime.exportOutput ? (
                <p style={{ margin: 0, color: "#64748b" }}>
                  {t("preview.runtime.emptyOutput")}
                </p>
              ) : null}

              {(previewRuntime.status === "failed" || previewRuntime.renderStatus === "failed") &&
              (previewRuntime.lastErrorCode || previewRuntime.lastErrorMessage) ? (
                <div style={{ display: "grid", gap: "6px", color: "#991b1b" }}>
                  {previewRuntime.lastErrorCode ? (
                    <p style={{ margin: 0 }}>
                      {t("preview.runtime.lastErrorCode", {
                        code: previewRuntime.lastErrorCode,
                      })}
                    </p>
                  ) : null}
                  {previewRuntime.lastErrorMessage ? (
                    <p style={{ margin: 0 }}>
                      {t("preview.runtime.lastErrorMessage", {
                        message: previewRuntime.lastErrorMessage,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
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
