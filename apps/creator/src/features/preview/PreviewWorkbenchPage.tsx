import type { CSSProperties, ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { PreviewAudioSummaryViewModel } from "../audio/audioWorkbench";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type {
  PreviewItemViewModel,
  PreviewShotOptionViewModel,
  PreviewWorkbenchViewModel,
} from "./previewWorkbench";
import type { PreviewRuntimeViewModel } from "./previewRuntime";
import {
  formatRuntimeField,
  formatRuntimeNumber,
  formatTimelineShot,
  formatTimelineTransition,
} from "../../../../shared/preview/previewRuntimeFormatting";

type PreviewWorkbenchPageProps = {
  previewWorkbench: PreviewWorkbenchViewModel;
  draftItems: PreviewItemViewModel[];
  shotOptions: PreviewShotOptionViewModel[];
  selectedShotOptionId: string;
  shotOptionsErrorMessage: string;
  previewRuntime: PreviewRuntimeViewModel | null;
  runtimeErrorMessage: string;
  requestRenderDisabledReason: string;
  requestRenderPending: boolean;
  manualShotIdInput: string;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  audioSummary?: PreviewAudioSummaryViewModel | null;
  audioSummaryErrorMessage: string;
  t: CreatorTranslator;
  shellHeader?: ReactNode;
  onSelectedShotOptionIdChange: (value: string) => void;
  onAddItemFromChooser: () => void;
  onManualShotIdInputChange: (value: string) => void;
  onAddManualItem: () => void;
  onRequestPreviewRender: () => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: "up" | "down") => void;
  onSaveAssembly: () => void;
  onOpenShotWorkbench: (shotId: string) => void;
  onOpenAudioWorkbench: () => void;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
};

const panelStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "#ffffff",
  padding: "20px",
  display: "grid",
  gap: "16px",
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)",
};

const inputStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.45)",
  padding: "10px 12px",
  font: "inherit",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: "999px",
  padding: "10px 18px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "10px 18px",
  background: "#4338ca",
  color: "#eef2ff",
  cursor: "pointer",
};

type OutputLinkProps = {
  href: string;
  label: string;
  style: CSSProperties;
};

function formatShotIdentity(item: PreviewItemViewModel, t: CreatorTranslator) {
  if (!item.shotSummary) {
    return item.shotId || t("preview.metadata.unavailable");
  }

  const sceneSegment = item.shotSummary.sceneCode || item.shotSummary.sceneId || item.shotId;
  const shotSegment = item.shotSummary.shotCode || item.shotSummary.shotId || item.shotId;
  return `${sceneSegment} / ${shotSegment}`;
}

function formatShotTitle(item: PreviewItemViewModel, t: CreatorTranslator) {
  if (!item.shotSummary) {
    return t("preview.metadata.unavailable");
  }

  const sceneTitle = item.shotSummary.sceneTitle || item.shotSummary.sceneCode || item.shotSummary.sceneId;
  const shotTitle = item.shotSummary.shotTitle || item.shotSummary.shotCode || item.shotSummary.shotId;
  return `${sceneTitle} / ${shotTitle}`;
}

function formatPrimaryAssetSummary(item: PreviewItemViewModel, t: CreatorTranslator) {
  if (item.primaryAssetSummary) {
    return `${item.primaryAssetSummary.mediaType || "asset"} · ${item.primaryAssetSummary.rightsStatus || "unknown"} · ${item.primaryAssetSummary.aiAnnotated ? "AI annotated" : "Human curated"}`;
  }
  if (item.primaryAssetId) {
    return `${t("preview.inputs.primaryAssetId")}：${item.primaryAssetId}`;
  }
  return t("preview.metadata.primaryAssetMissing");
}

function formatSourceRunSummary(item: PreviewItemViewModel, t: CreatorTranslator) {
  if (item.sourceRunSummary) {
    return `${item.sourceRunSummary.status || "unknown"} · ${item.sourceRunSummary.triggerType || "unknown"}`;
  }
  if (item.sourceRunId) {
    return `${t("preview.inputs.sourceRunId")}：${item.sourceRunId}`;
  }
  return t("preview.metadata.sourceRunMissing");
}

function formatChooserPrimaryAsset(
  option: PreviewShotOptionViewModel | null,
  t: CreatorTranslator,
) {
  if (!option) {
    return "";
  }
  if (!option.currentPrimaryAssetSummary) {
    return t("preview.metadata.primaryAssetMissing");
  }
  return `${option.currentPrimaryAssetSummary.mediaType || "asset"} · ${option.currentPrimaryAssetSummary.rightsStatus || "unknown"} · ${option.currentPrimaryAssetSummary.aiAnnotated ? "AI annotated" : "Human curated"}`;
}

function formatChooserRun(option: PreviewShotOptionViewModel | null, t: CreatorTranslator) {
  if (!option) {
    return "";
  }
  if (!option.latestRunSummary) {
    return t("preview.metadata.sourceRunMissing");
  }
  return `${option.latestRunSummary.status || "unknown"} · ${option.latestRunSummary.triggerType || "unknown"}`;
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

export function PreviewWorkbenchPage({
  previewWorkbench,
  draftItems,
  shotOptions,
  selectedShotOptionId,
  shotOptionsErrorMessage,
  previewRuntime,
  runtimeErrorMessage,
  requestRenderDisabledReason,
  requestRenderPending,
  manualShotIdInput,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  audioSummary,
  audioSummaryErrorMessage,
  t,
  shellHeader,
  onSelectedShotOptionIdChange,
  onAddItemFromChooser,
  onManualShotIdInputChange,
  onAddManualItem,
  onRequestPreviewRender,
  onRemoveItem,
  onMoveItem,
  onSaveAssembly,
  onOpenShotWorkbench,
  onOpenAudioWorkbench,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: PreviewWorkbenchPageProps) {
  const selectedShotOption =
    shotOptions.find((option) => option.shotId === selectedShotOptionId) ?? null;

  return (
    <main style={{ display: "grid", gap: "24px", padding: "0 24px 40px" }}>
      {shellHeader}

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("preview.summary.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.itemCount", { count: draftItems.length })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("preview.summary.status", { status: previewWorkbench.assembly.status })}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <strong>{t("preview.chooser.title")}</strong>
            <p style={{ margin: 0, color: "#475569" }}>{t("preview.chooser.description")}</p>
            <label style={{ display: "grid", gap: "6px" }}>
              <span>{t("preview.chooser.label")}</span>
              <select
                value={selectedShotOptionId}
                onChange={(event) => {
                  onSelectedShotOptionIdChange(event.target.value);
                }}
                style={inputStyle}
              >
                {shotOptions.length === 0 ? (
                  <option value="">{t("preview.chooser.empty")}</option>
                ) : null}
                {shotOptions.map((option) => (
                  <option key={option.shotExecutionId || option.shotId} value={option.shotId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedShotOption ? (
              <div style={{ display: "grid", gap: "4px", color: "#475569" }}>
                <span>{selectedShotOption.label}</span>
                <span>
                  {selectedShotOption.shotSummary.sceneTitle} / {selectedShotOption.shotSummary.shotTitle}
                </span>
                <span>{formatChooserPrimaryAsset(selectedShotOption, t)}</span>
                <span>{formatChooserRun(selectedShotOption, t)}</span>
              </div>
            ) : null}
            {shotOptionsErrorMessage ? (
              <p style={{ margin: 0, color: "#991b1b" }}>{shotOptionsErrorMessage}</p>
            ) : null}
            <div>
              <button
                type="button"
                onClick={onAddItemFromChooser}
                disabled={!selectedShotOptionId}
                style={{
                  ...secondaryButtonStyle,
                  opacity: selectedShotOptionId ? 1 : 0.45,
                  cursor: selectedShotOptionId ? "pointer" : "not-allowed",
                }}
              >
                {t("preview.actions.addFromChooser")}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <strong>{t("preview.manual.title")}</strong>
            <p style={{ margin: 0, color: "#475569" }}>{t("preview.manual.description")}</p>
            <label style={{ display: "grid", gap: "6px" }}>
              <span>{t("preview.inputs.shotId")}</span>
              <input
                value={manualShotIdInput}
                placeholder={t("preview.inputs.shotIdPlaceholder")}
                onChange={(event) => {
                  onManualShotIdInputChange(event.target.value);
                }}
                style={inputStyle}
              />
            </label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button type="button" onClick={onAddManualItem} style={secondaryButtonStyle}>
                {t("preview.actions.addManualItem")}
              </button>
              <button type="button" onClick={onSaveAssembly} style={primaryButtonStyle}>
                {t("preview.actions.saveAssembly")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
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
                  {previewRuntime.playback.posterUrl ? (
                    <p style={{ margin: 0 }}>
                      {t("preview.runtime.playback.posterUrlLabel", {
                        url: previewRuntime.playback.posterUrl,
                      })}
                    </p>
                  ) : null}
                  {previewRuntime.playback.deliveryMode === "file" &&
                  previewRuntime.playback.playbackUrl ? (
                    <video
                      data-testid="preview-runtime-video"
                      controls
                      src={previewRuntime.playback.playbackUrl}
                      poster={previewRuntime.playback.posterUrl || undefined}
                      style={{ width: "100%", maxWidth: "640px", borderRadius: "14px" }}
                    />
                  ) : null}
                  {previewRuntime.playback.playbackUrl ? (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {previewRuntime.playback.deliveryMode === "manifest" ? (
                        <p style={{ margin: 0, wordBreak: "break-all" }}>
                          {previewRuntime.playback.playbackUrl}
                        </p>
                      ) : null}
                      <OutputLink
                        href={previewRuntime.playback.playbackUrl}
                        label={t("preview.runtime.playback.open")}
                        style={secondaryButtonStyle}
                      />
                    </div>
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
                                transition: formatTimelineTransition(
                                  segment.transitionToNext,
                                  t("preview.runtime.emptyValue"),
                                ),
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
                  {previewRuntime.exportOutput.downloadUrl ? (
                    <OutputLink
                      href={previewRuntime.exportOutput.downloadUrl}
                      label={t("preview.runtime.export.open")}
                      style={secondaryButtonStyle}
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
        {requestRenderDisabledReason ? (
          <p style={{ margin: 0, color: "#475569" }}>{requestRenderDisabledReason}</p>
        ) : null}
        <div>
          <button
            type="button"
            onClick={onRequestPreviewRender}
            disabled={Boolean(requestRenderDisabledReason)}
            style={{
              ...secondaryButtonStyle,
              opacity: requestRenderDisabledReason ? 0.45 : 1,
              cursor: requestRenderDisabledReason ? "not-allowed" : "pointer",
            }}
          >
            {requestRenderPending
              ? t("preview.actions.requestRenderPending")
              : t("preview.actions.requestRender")}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("preview.audio.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("preview.audio.description")}</p>
        </div>
        {audioSummary ? (
          <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
            <p style={{ margin: 0 }}>{t("preview.audio.trackCount", { count: audioSummary.trackCount })}</p>
            <p style={{ margin: 0 }}>{t("preview.audio.clipCount", { count: audioSummary.clipCount })}</p>
            <p style={{ margin: 0 }}>{t("preview.audio.renderStatus", { status: audioSummary.renderStatus })}</p>
            <p style={{ margin: 0 }}>
              {t("preview.audio.missingAssetCount", { count: audioSummary.missingAssetCount })}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>
            {audioSummaryErrorMessage || t("preview.audio.empty")}
          </p>
        )}
        <div>
          <button type="button" onClick={onOpenAudioWorkbench} style={secondaryButtonStyle}>
            {t("preview.audio.openWorkbench")}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("preview.items.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("preview.items.description")}</p>
        </div>
        {draftItems.length === 0 ? (
          <div style={{ display: "grid", gap: "8px", color: "#475569" }}>
            <strong>{t("preview.empty.title")}</strong>
            <p style={{ margin: 0 }}>{t("preview.empty.description")}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {draftItems.map((item) => (
              <article
                key={item.itemId}
                data-testid={`preview-item-${item.itemId}`}
                style={{
                  borderRadius: "16px",
                  padding: "16px",
                  background: "rgba(241, 245, 249, 0.9)",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{t("preview.item.sequence", { sequence: item.sequence })}</strong>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        onMoveItem(item.itemId, "up");
                      }}
                      style={secondaryButtonStyle}
                    >
                      {t("preview.actions.moveUp")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMoveItem(item.itemId, "down");
                      }}
                      style={secondaryButtonStyle}
                    >
                      {t("preview.actions.moveDown")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRemoveItem(item.itemId);
                      }}
                      style={secondaryButtonStyle}
                    >
                      {t("preview.actions.removeItem")}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
                  <strong>{formatShotIdentity(item, t)}</strong>
                  <span>{formatShotTitle(item, t)}</span>
                  <span>{formatPrimaryAssetSummary(item, t)}</span>
                  <span>{formatSourceRunSummary(item, t)}</span>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenShotWorkbench(item.shotId);
                    }}
                    style={secondaryButtonStyle}
                  >
                    {t("preview.actions.openShot")}
                  </button>
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
                      ...secondaryButtonStyle,
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
      </section>

      <AssetProvenanceDialog
        assetProvenanceDetail={assetProvenanceDetail}
        assetProvenancePending={assetProvenancePending}
        assetProvenanceErrorMessage={assetProvenanceErrorMessage}
        onCloseAssetProvenance={onCloseAssetProvenance}
        t={t}
      />
    </main>
  );
}
