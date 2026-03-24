import type { CSSProperties, ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type { PreviewAudioSummaryViewModel } from "../audio/audioWorkbench";
import type { PreviewItemViewModel, PreviewWorkbenchViewModel } from "./previewWorkbench";

type PreviewWorkbenchPageProps = {
  previewWorkbench: PreviewWorkbenchViewModel;
  draftItems: PreviewItemViewModel[];
  newShotIdInput: string;
  newPrimaryAssetIdInput: string;
  newSourceRunIdInput: string;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  audioSummary?: PreviewAudioSummaryViewModel | null;
  audioSummaryErrorMessage: string;
  t: CreatorTranslator;
  shellHeader?: ReactNode;
  onNewShotIdInputChange: (value: string) => void;
  onNewPrimaryAssetIdInputChange: (value: string) => void;
  onNewSourceRunIdInputChange: (value: string) => void;
  onDraftItemFieldChange: (
    itemId: string,
    field: "shotId" | "primaryAssetId" | "sourceRunId",
    value: string,
  ) => void;
  onAddItem: () => void;
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

export function PreviewWorkbenchPage({
  previewWorkbench,
  draftItems,
  newShotIdInput,
  newPrimaryAssetIdInput,
  newSourceRunIdInput,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  audioSummary,
  audioSummaryErrorMessage,
  t,
  shellHeader,
  onNewShotIdInputChange,
  onNewPrimaryAssetIdInputChange,
  onNewSourceRunIdInputChange,
  onDraftItemFieldChange,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onSaveAssembly,
  onOpenShotWorkbench,
  onOpenAudioWorkbench,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
}: PreviewWorkbenchPageProps) {
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("preview.inputs.shotId")}</span>
            <input
              value={newShotIdInput}
              placeholder={t("preview.inputs.shotIdPlaceholder")}
              onChange={(event) => {
                onNewShotIdInputChange(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("preview.inputs.primaryAssetId")}</span>
            <input
              value={newPrimaryAssetIdInput}
              placeholder={t("preview.inputs.primaryAssetIdPlaceholder")}
              onChange={(event) => {
                onNewPrimaryAssetIdInputChange(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("preview.inputs.sourceRunId")}</span>
            <input
              value={newSourceRunIdInput}
              placeholder={t("preview.inputs.sourceRunIdPlaceholder")}
              onChange={(event) => {
                onNewSourceRunIdInputChange(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={onAddItem} style={secondaryButtonStyle}>
            {t("preview.actions.addItem")}
          </button>
          <button type="button" onClick={onSaveAssembly} style={primaryButtonStyle}>
            {t("preview.actions.saveAssembly")}
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
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span>{t("preview.inputs.shotId")}</span>
                    <input
                      value={item.shotId}
                      onChange={(event) => {
                        onDraftItemFieldChange(item.itemId, "shotId", event.target.value);
                      }}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span>{t("preview.inputs.primaryAssetId")}</span>
                    <input
                      value={item.primaryAssetId}
                      onChange={(event) => {
                        onDraftItemFieldChange(item.itemId, "primaryAssetId", event.target.value);
                      }}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span>{t("preview.inputs.sourceRunId")}</span>
                    <input
                      value={item.sourceRunId}
                      onChange={(event) => {
                        onDraftItemFieldChange(item.itemId, "sourceRunId", event.target.value);
                      }}
                      style={inputStyle}
                    />
                  </label>
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
