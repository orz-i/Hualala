import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type {
  AudioAssetPoolItemViewModel,
  AudioTrackViewModel,
  AudioWorkbenchViewModel,
} from "./audioWorkbench";

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

type AudioWorkbenchPageProps = {
  audioWorkbench: AudioWorkbenchViewModel;
  draftTracks: AudioTrackViewModel[];
  audioAssetPool: AudioAssetPoolItemViewModel[];
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
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
};

export function AudioWorkbenchPage({
  audioWorkbench,
  draftTracks,
  audioAssetPool,
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
          {t("audio.summary.clipCount", { count: audioWorkbench.summary.clipCount })}
        </p>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("audio.summary.renderStatus", {
            status: audioWorkbench.timeline.renderStatus || "unknown",
          })}
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={onSaveTimeline} style={primaryButtonStyle}>
            {t("audio.actions.saveTimeline")}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("audio.pool.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("audio.pool.description")}</p>
        </div>
        {audioAssetPool.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("audio.pool.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {audioAssetPool.map((item) => (
              <article
                key={item.variantId}
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
                      <option key={item.variantId} value={item.assetId}>
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
