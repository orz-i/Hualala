import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import type {
  AudioMixOutputViewModel,
  AudioRuntimeViewModel,
  AudioWaveformReferenceViewModel,
} from "../../../../shared/audio/audioRuntime";
import {
  buildRuntimeOutputLinkStyle,
  formatRuntimeField,
  formatRuntimeNumber,
} from "../../../../shared/audio/audioRuntimeFormatting";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type {
  AudioAssetPoolItemViewModel,
  AudioTrackViewModel,
  AudioWorkbenchViewModel,
} from "./audioWorkbench";
import { countAudioClips } from "./audioWorkbench";

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
  background: "#0f766e",
  color: "#ecfdf5",
  cursor: "pointer",
};

type OutputLinkProps = {
  href: string;
  children: ReactNode;
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

type AudioWorkbenchPageProps = {
  audioWorkbench: AudioWorkbenchViewModel;
  draftTracks: AudioTrackViewModel[];
  audioAssetPool: AudioAssetPoolItemViewModel[];
  audioAssetPoolErrorMessage: string;
  audioRuntime: AudioRuntimeViewModel | null;
  runtimeErrorMessage: string;
  requestRenderDisabledReason: string;
  requestRenderPending: boolean;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  t: CreatorTranslator;
  shellHeader?: ReactNode;
  onAddClip: (trackId: string, assetId: string) => void;
  onRemoveClip: (trackId: string, clipId: string) => void;
  onMoveClip: (trackId: string, clipId: string, direction: "up" | "down") => void;
  onTrackVolumeChange: (trackId: string, value: number) => void;
  onTrackMutedChange: (trackId: string, muted: boolean) => void;
  onTrackSoloChange: (trackId: string, solo: boolean) => void;
  onClipFieldChange: (
    trackId: string,
    clipId: string,
    field: "startMs" | "durationMs" | "trimInMs" | "trimOutMs",
    value: number,
  ) => void;
  onSaveTimeline: () => void;
  onRequestAudioRender: () => void;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
};

function renderMixOutput(
  mixOutput: AudioMixOutputViewModel | null,
  t: CreatorTranslator,
) {
  if (!mixOutput) {
    return <p style={{ margin: 0, color: "#64748b" }}>{t("audio.runtime.emptyOutput")}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
      <p style={{ margin: 0 }}>
        {t("audio.runtime.mix.deliveryMode", {
          mode: formatRuntimeField(mixOutput.deliveryMode, t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0, wordBreak: "break-all" }}>
        {t("audio.runtime.mix.playbackUrl", {
          url: formatRuntimeField(mixOutput.playbackUrl, t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0, wordBreak: "break-all" }}>
        {t("audio.runtime.mix.downloadUrl", {
          url: formatRuntimeField(mixOutput.downloadUrl, t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0 }}>
        {t("audio.runtime.mix.mimeType", {
          mimeType: formatRuntimeField(mixOutput.mimeType, t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0 }}>
        {t("audio.runtime.mix.fileName", {
          fileName: formatRuntimeField(mixOutput.fileName, t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0 }}>
        {t("audio.runtime.mix.sizeBytes", {
          sizeBytes: formatRuntimeNumber(mixOutput.sizeBytes, " B", t("audio.runtime.emptyValue")),
        })}
      </p>
      <p style={{ margin: 0 }}>
        {t("audio.runtime.mix.duration", {
          duration: formatRuntimeNumber(mixOutput.durationMs, "ms", t("audio.runtime.emptyValue")),
        })}
      </p>
      {mixOutput.deliveryMode === "file" && mixOutput.playbackUrl ? (
        <audio
          data-testid="audio-runtime-player"
          controls
          src={mixOutput.playbackUrl}
          style={{ width: "100%", maxWidth: "640px" }}
        />
      ) : null}
      {mixOutput.downloadUrl ? (
        <OutputLink
          href={mixOutput.downloadUrl}
          style={secondaryButtonStyle}
        >
          {t("audio.runtime.mix.open")}
        </OutputLink>
      ) : null}
    </div>
  );
}

function renderWaveforms(
  waveforms: AudioWaveformReferenceViewModel[],
  t: CreatorTranslator,
) {
  if (waveforms.length === 0) {
    return <p style={{ margin: 0, color: "#64748b" }}>{t("audio.runtime.waveforms.empty")}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {waveforms.map((waveform) => (
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
              variantId: formatRuntimeField(waveform.variantId, t("audio.runtime.emptyValue")),
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
              style={secondaryButtonStyle}
            >
              {t("audio.runtime.waveforms.open")}
            </OutputLink>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function AudioWorkbenchPage({
  audioWorkbench,
  draftTracks,
  audioAssetPool,
  audioAssetPoolErrorMessage,
  audioRuntime,
  runtimeErrorMessage,
  requestRenderDisabledReason,
  requestRenderPending,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  shellHeader,
  onAddClip,
  onRemoveClip,
  onMoveClip,
  onTrackVolumeChange,
  onTrackMutedChange,
  onTrackSoloChange,
  onClipFieldChange,
  onSaveTimeline,
  onRequestAudioRender,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: AudioWorkbenchPageProps) {
  const [selectedAssetIdByTrackId, setSelectedAssetIdByTrackId] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    setSelectedAssetIdByTrackId((current) => {
      const nextState: Record<string, string> = {};
      draftTracks.forEach((track) => {
        nextState[track.trackId] = current[track.trackId] ?? audioAssetPool[0]?.assetId ?? "";
      });
      return nextState;
    });
  }, [audioAssetPool, draftTracks]);

  const draftClipCount = countAudioClips(draftTracks);

  return (
    <main style={{ display: "grid", gap: "24px", padding: "0 24px 40px" }}>
      {shellHeader}

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>{t("audio.summary.title")}</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("audio.summary.status", { status: audioWorkbench.timeline.status })}
        </p>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("audio.summary.trackCount", { count: draftTracks.length })}
        </p>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("audio.summary.clipCount", { count: draftClipCount })}
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={onSaveTimeline} style={primaryButtonStyle}>
            {t("audio.actions.saveTimeline")}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.runtime.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.runtime.description")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRequestAudioRender}
            disabled={Boolean(requestRenderDisabledReason)}
            style={{
              ...primaryButtonStyle,
              opacity: requestRenderDisabledReason ? 0.45 : 1,
              cursor: requestRenderDisabledReason ? "not-allowed" : "pointer",
            }}
          >
            {requestRenderPending ? t("audio.actions.requestRenderPending") : t("audio.actions.requestRender")}
          </button>
        </div>
        {requestRenderDisabledReason ? (
          <p style={{ margin: 0, color: "#7c2d12" }}>{requestRenderDisabledReason}</p>
        ) : null}
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
              {renderMixOutput(audioRuntime.mixOutput, t)}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>{t("audio.runtime.waveforms.title")}</strong>
              {renderWaveforms(audioRuntime.waveforms, t)}
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
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.pool.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.pool.description")}</p>
        </div>
        {audioAssetPoolErrorMessage ? (
          <p style={{ margin: 0, color: "#991b1b" }}>{audioAssetPoolErrorMessage}</p>
        ) : null}
        {audioAssetPool.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("audio.pool.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {audioAssetPool.map((item) => (
              <article
                key={item.assetId}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <strong>{item.fileName || item.assetId}</strong>
                <span style={{ color: "#475569" }}>
                  {t("audio.pool.itemMeta", {
                    durationMs: item.durationMs,
                    mimeType: item.mimeType || "unknown",
                    rightsStatus: item.rightsStatus || "unknown",
                  })}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.timeline.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.timeline.description")}</p>
        </div>
        <div style={{ display: "grid", gap: "14px" }}>
          {draftTracks.map((track) => (
            <article
              key={track.trackId}
              data-testid={`audio-track-${track.trackType}`}
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
                <div style={{ display: "grid", gap: "4px" }}>
                  <strong>{track.displayName}</strong>
                  <span style={{ color: "#475569" }}>
                    {t("audio.track.sequence", {
                      sequence: track.sequence,
                      trackType: track.trackType,
                    })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={track.muted}
                      onChange={(event) => {
                        onTrackMutedChange(track.trackId, event.target.checked);
                      }}
                    />
                    <span>{t("audio.track.muted")}</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={track.solo}
                      onChange={(event) => {
                        onTrackSoloChange(track.trackId, event.target.checked);
                      }}
                    />
                    <span>{t("audio.track.solo")}</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{t("audio.track.volume")}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={track.volumePercent}
                      onChange={(event) => {
                        onTrackVolumeChange(track.trackId, Number(event.target.value));
                      }}
                      style={{ ...inputStyle, width: "88px" }}
                    />
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "12px",
                  alignItems: "end",
                }}
              >
                <label style={{ display: "grid", gap: "6px" }}>
                  <span>{t("audio.actions.pickAsset")}</span>
                  <select
                    value={selectedAssetIdByTrackId[track.trackId] ?? ""}
                    onChange={(event) => {
                      setSelectedAssetIdByTrackId((current) => ({
                        ...current,
                        [track.trackId]: event.target.value,
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="">{t("audio.pool.selectPlaceholder")}</option>
                    {audioAssetPool.map((item) => (
                      <option key={item.assetId} value={item.assetId}>
                        {item.fileName || item.assetId}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const assetId = selectedAssetIdByTrackId[track.trackId];
                    if (!assetId) {
                      return;
                    }
                    onAddClip(track.trackId, assetId);
                  }}
                  style={secondaryButtonStyle}
                >
                  {t("audio.actions.addClip")}
                </button>
              </div>

              {track.clips.length === 0 ? (
                <p style={{ margin: 0, color: "#64748b" }}>{t("audio.track.empty")}</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {track.clips.map((clip) => (
                    <article
                      key={clip.clipId}
                      data-testid={`audio-clip-${clip.clipId}`}
                      style={{
                        borderRadius: "14px",
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        background: "#ffffff",
                        padding: "14px",
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
                        <strong>{clip.assetId}</strong>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              onMoveClip(track.trackId, clip.clipId, "up");
                            }}
                            style={secondaryButtonStyle}
                          >
                            {t("preview.actions.moveUp")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onMoveClip(track.trackId, clip.clipId, "down");
                            }}
                            style={secondaryButtonStyle}
                          >
                            {t("preview.actions.moveDown")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveClip(track.trackId, clip.clipId);
                            }}
                            style={secondaryButtonStyle}
                          >
                            {t("preview.actions.removeItem")}
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        {([
                          ["startMs", clip.startMs],
                          ["durationMs", clip.durationMs],
                          ["trimInMs", clip.trimInMs],
                          ["trimOutMs", clip.trimOutMs],
                        ] as const).map(([field, value]) => (
                          <label key={field} style={{ display: "grid", gap: "6px" }}>
                            <span>{t(`audio.clip.${field}` as never)}</span>
                            <input
                              type="number"
                              min={0}
                              value={value}
                              onChange={(event) => {
                                onClipFieldChange(
                                  track.trackId,
                                  clip.clipId,
                                  field,
                                  Number(event.target.value),
                                );
                              }}
                              style={inputStyle}
                            />
                          </label>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!clip.assetId) {
                              return;
                            }
                            onOpenAssetProvenance(clip.assetId);
                          }}
                          disabled={!clip.assetId}
                          style={{
                            ...secondaryButtonStyle,
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
