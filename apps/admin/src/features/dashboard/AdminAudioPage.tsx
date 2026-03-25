import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import {
  buildRuntimeOutputLinkStyle,
  formatRuntimeField,
  formatRuntimeNumber,
} from "../../../../shared/audio/audioRuntimeFormatting";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminAudioWorkbenchViewModel } from "./adminAudio";
import type { AdminAudioRuntimeViewModel } from "./adminAudioRuntime";
import { AssetProvenanceDialog } from "./overview-page/AssetProvenanceDialog";

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
  children: string;
  style?: CSSProperties;
};

function OutputLink({ href, children, style }: OutputLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={buildRuntimeOutputLinkStyle(style)}
    >
      {children}
    </a>
  );
}

type AdminAudioPageProps = {
  audioWorkbench: AdminAudioWorkbenchViewModel;
  audioRuntime: AdminAudioRuntimeViewModel | null;
  runtimeErrorMessage: string;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  t: AdminTranslator;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
};

export function AdminAudioPage({
  audioWorkbench,
  audioRuntime,
  runtimeErrorMessage,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: AdminAudioPageProps) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.panel.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("audio.summary.status", { status: audioWorkbench.timeline.status })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("audio.summary.trackCount", { count: audioWorkbench.summary.trackCount })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("audio.summary.clipCount", { count: audioWorkbench.summary.clipCount })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("audio.summary.missingAssetCount", {
              count: audioWorkbench.summary.missingAssetCount,
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("audio.summary.invalidTimingClipCount", {
              count: audioWorkbench.summary.invalidTimingClipCount,
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
          <h2 style={{ margin: 0 }}>{t("audio.runtime.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.runtime.description")}</p>
        </div>
        {runtimeErrorMessage ? (
          <p style={{ margin: 0, color: "#991b1b" }}>{runtimeErrorMessage}</p>
        ) : null}
        {audioRuntime ? (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
              <p style={{ margin: 0 }}>
                {t("audio.runtime.status", {
                  status: formatRuntimeField(audioRuntime.status, t("audio.runtime.emptyValue")),
                })}
              </p>
              <p style={{ margin: 0 }}>
                {t("audio.runtime.renderStatus", {
                  status: formatRuntimeField(audioRuntime.renderStatus, t("audio.runtime.emptyValue")),
                })}
              </p>
              <p style={{ margin: 0 }}>
                {t("audio.runtime.workflowRunId", {
                  workflowRunId: formatRuntimeField(
                    audioRuntime.renderWorkflowRunId,
                    t("audio.runtime.emptyValue"),
                  ),
                })}
              </p>
              <p style={{ margin: 0 }}>
                {t("audio.runtime.mixAssetId", {
                  assetId: formatRuntimeField(audioRuntime.mixAssetId, t("audio.runtime.emptyValue")),
                })}
              </p>
              <p style={{ margin: 0 }}>
                {t("audio.runtime.updatedAt", {
                  updatedAt: formatRuntimeField(audioRuntime.updatedAt, t("audio.runtime.emptyValue")),
                })}
              </p>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>{t("audio.runtime.mix.title")}</strong>
              {audioRuntime.mixOutput ? (
                <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
                  <p style={{ margin: 0 }}>
                    {t("audio.runtime.mix.deliveryMode", {
                      mode: formatRuntimeField(
                        audioRuntime.mixOutput.deliveryMode,
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0, wordBreak: "break-all" }}>
                    {t("audio.runtime.mix.playbackUrl", {
                      url: formatRuntimeField(
                        audioRuntime.mixOutput.playbackUrl,
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0, wordBreak: "break-all" }}>
                    {t("audio.runtime.mix.downloadUrl", {
                      url: formatRuntimeField(
                        audioRuntime.mixOutput.downloadUrl,
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("audio.runtime.mix.mimeType", {
                      mimeType: formatRuntimeField(
                        audioRuntime.mixOutput.mimeType,
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("audio.runtime.mix.fileName", {
                      fileName: formatRuntimeField(
                        audioRuntime.mixOutput.fileName,
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("audio.runtime.mix.sizeBytes", {
                      sizeBytes: formatRuntimeNumber(
                        audioRuntime.mixOutput.sizeBytes,
                        " B",
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  <p style={{ margin: 0 }}>
                    {t("audio.runtime.mix.duration", {
                      duration: formatRuntimeNumber(
                        audioRuntime.mixOutput.durationMs,
                        "ms",
                        t("audio.runtime.emptyValue"),
                      ),
                    })}
                  </p>
                  {audioRuntime.mixOutput.downloadUrl ? (
                    <OutputLink
                      href={audioRuntime.mixOutput.downloadUrl}
                      style={buttonStyle}
                    >
                      {t("audio.runtime.mix.open")}
                    </OutputLink>
                  ) : null}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#64748b" }}>{t("audio.runtime.emptyOutput")}</p>
              )}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>{t("audio.runtime.waveforms.title")}</strong>
              {audioRuntime.waveforms.length === 0 ? (
                <p style={{ margin: 0, color: "#64748b" }}>{t("audio.runtime.waveforms.empty")}</p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {audioRuntime.waveforms.map((waveform) => (
                    <article
                      key={`${waveform.assetId}:${waveform.variantId}`}
                      style={{
                        borderRadius: "14px",
                        padding: "12px 14px",
                        background: "rgba(241, 245, 249, 0.9)",
                        display: "grid",
                        gap: "6px",
                        color: "#475569",
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        {t("audio.runtime.waveforms.assetId", {
                          assetId: formatRuntimeField(waveform.assetId, t("audio.runtime.emptyValue")),
                        })}
                      </p>
                      <p style={{ margin: 0 }}>
                        {t("audio.runtime.waveforms.variantId", {
                          variantId: formatRuntimeField(
                            waveform.variantId,
                            t("audio.runtime.emptyValue"),
                          ),
                        })}
                      </p>
                      <p style={{ margin: 0, wordBreak: "break-all" }}>
                        {t("audio.runtime.waveforms.waveformUrl", {
                          url: formatRuntimeField(waveform.waveformUrl, t("audio.runtime.emptyValue")),
                        })}
                      </p>
                      <p style={{ margin: 0 }}>
                        {t("audio.runtime.waveforms.mimeType", {
                          mimeType: formatRuntimeField(waveform.mimeType, t("audio.runtime.emptyValue")),
                        })}
                      </p>
                      <p style={{ margin: 0 }}>
                        {t("audio.runtime.waveforms.duration", {
                          duration: formatRuntimeNumber(
                            waveform.durationMs,
                            "ms",
                            t("audio.runtime.emptyValue"),
                          ),
                        })}
                      </p>
                      {waveform.waveformUrl ? (
                        <OutputLink
                          href={waveform.waveformUrl}
                          style={buttonStyle}
                        >
                          {t("audio.runtime.waveforms.open")}
                        </OutputLink>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>

            {audioRuntime.lastErrorCode ? (
              <p style={{ margin: 0, color: "#991b1b" }}>
                {t("audio.runtime.lastErrorCode", { code: audioRuntime.lastErrorCode })}
              </p>
            ) : null}
            {audioRuntime.lastErrorMessage ? (
              <p style={{ margin: 0, color: "#991b1b" }}>
                {t("audio.runtime.lastErrorMessage", { message: audioRuntime.lastErrorMessage })}
              </p>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>{t("audio.runtime.empty")}</p>
        )}
      </article>

      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.tracks.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.tracks.description")}</p>
        </div>
        {audioWorkbench.tracks.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("audio.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {audioWorkbench.tracks.map((track) => (
              <article
                key={track.trackId}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <strong>{track.displayName}</strong>
                <span style={{ color: "#475569" }}>
                  {t("audio.track.meta", {
                    trackType: track.trackType,
                    clipCount: track.clips.length,
                    volumePercent: track.volumePercent,
                  })}
                </span>
                {track.clips.length === 0 ? (
                  <p style={{ margin: 0, color: "#64748b" }}>{t("audio.track.empty")}</p>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {track.clips.map((clip) => (
                      <article
                        key={clip.clipId}
                        style={{
                          borderRadius: "12px",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          background: "#ffffff",
                          padding: "12px",
                          display: "grid",
                          gap: "6px",
                        }}
                      >
                        <strong>{clip.assetId || t("audio.clip.missingAsset")}</strong>
                        <span style={{ color: "#475569" }}>
                          {t("audio.clip.meta", {
                            sourceRunId: clip.sourceRunId || "none",
                            startMs: clip.startMs,
                            durationMs: clip.durationMs,
                          })}
                        </span>
                        <div>
                          <button
                            type="button"
                            disabled={!clip.assetId}
                            onClick={() => {
                              if (!clip.assetId) {
                                return;
                              }
                              onOpenAssetProvenance(clip.assetId);
                            }}
                            style={{
                              ...buttonStyle,
                              opacity: clip.assetId ? 1 : 0.45,
                              cursor: clip.assetId ? "pointer" : "not-allowed",
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
