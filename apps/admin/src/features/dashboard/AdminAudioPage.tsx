import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminAudioWorkbenchViewModel } from "./adminAudio";
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

export function AdminAudioPage({
  audioWorkbench,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: {
  audioWorkbench: AdminAudioWorkbenchViewModel;
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
            {t("audio.summary.renderStatus", { status: audioWorkbench.timeline.renderStatus })}
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
