import type { CSSProperties, FormEvent, ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import { ActionFeedback, type ActionFeedbackModel } from "../shared/ActionFeedback";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";
import type { ShotWorkbenchViewModel } from "../shot-workbench/ShotWorkbenchPage";
import type { ReusableAssetLibraryItemViewModel } from "./reuse";

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

const buttonStyle: CSSProperties = {
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
  color: "#ecfeff",
  cursor: "pointer",
};

function handleSubmit(event: FormEvent<HTMLFormElement>, callback: () => void) {
  event.preventDefault();
  callback();
}

export function AssetReusePage({
  shotWorkbench,
  reusableAssets,
  sourceProjectIdInput,
  loading,
  errorMessage,
  feedback,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  t,
  shellHeader,
  onSourceProjectIdInputChange,
  onLoadSourceProject,
  onApplyReuse,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
  onBackToShotWorkbench,
}: {
  shotWorkbench: ShotWorkbenchViewModel;
  reusableAssets: ReusableAssetLibraryItemViewModel[];
  sourceProjectIdInput: string;
  loading: boolean;
  errorMessage: string;
  feedback: ActionFeedbackModel | null;
  assetProvenanceDetail: AssetProvenanceDetailViewModel | null;
  assetProvenancePending: boolean;
  assetProvenanceErrorMessage: string;
  t: CreatorTranslator;
  shellHeader?: ReactNode;
  onSourceProjectIdInputChange: (value: string) => void;
  onLoadSourceProject: () => void;
  onApplyReuse: (assetId: string) => void;
  onOpenAssetProvenance: (assetId: string) => void;
  onCloseAssetProvenance: () => void;
  onBackToShotWorkbench: (shotId: string) => void;
}) {
  return (
    <main style={{ display: "grid", gap: "24px", padding: "0 24px 40px" }}>
      {shellHeader}

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("reuse.summary.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.currentShot", { shotId: shotWorkbench.shotExecution.shotId })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("reuse.summary.currentPrimaryAsset", {
              assetId: shotWorkbench.shotExecution.primaryAssetId || t("asset.provenance.none"),
            })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              onBackToShotWorkbench(shotWorkbench.shotExecution.shotId);
            }}
            style={buttonStyle}
          >
            {t("reuse.actions.backToShot")}
          </button>
        </div>
        {feedback ? <ActionFeedback feedback={feedback} /> : null}
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("reuse.sourceProject.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("reuse.sourceProject.description")}</p>
        </div>
        <form
          onSubmit={(event) => {
            handleSubmit(event, onLoadSourceProject);
          }}
          style={{ display: "grid", gap: "12px" }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("reuse.sourceProject.label")}</span>
            <input
              aria-label={t("reuse.sourceProject.label")}
              value={sourceProjectIdInput}
              placeholder={t("reuse.sourceProject.placeholder")}
              onChange={(event) => {
                onSourceProjectIdInputChange(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" style={primaryButtonStyle}>
              {t("reuse.sourceProject.load")}
            </button>
            {loading ? <span style={{ color: "#475569" }}>{t("reuse.loading")}</span> : null}
            {!loading && errorMessage ? (
              <span style={{ color: "#991b1b" }}>{errorMessage}</span>
            ) : null}
          </div>
        </form>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("reuse.list.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{t("reuse.list.description")}</p>
        </div>
        {reusableAssets.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("reuse.list.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {reusableAssets.map((asset) => (
              <article
                key={asset.assetId}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "14px 16px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <strong>{asset.assetId}</strong>
                <span style={{ color: "#475569" }}>
                  {t("reuse.item.fileName", {
                    fileName: asset.fileName || t("asset.provenance.none"),
                  })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("reuse.item.sourceProjectId", { projectId: asset.sourceProjectId })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("reuse.item.importBatchId", {
                    importBatchId: asset.importBatchId || t("asset.provenance.none"),
                  })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("reuse.item.sourceRunId", {
                    sourceRunId: asset.sourceRunId || t("asset.provenance.none"),
                  })}
                </span>
                <span style={{ color: "#475569" }}>
                  {t("reuse.item.meta", {
                    mimeType: asset.mimeType || t("asset.provenance.none"),
                    rightsStatus: asset.rightsStatus || t("asset.provenance.none"),
                    locale: asset.locale || t("asset.provenance.none"),
                  })}
                </span>
                {!asset.allowed && asset.blockedReason ? (
                  <span style={{ color: "#991b1b" }}>{asset.blockedReason}</span>
                ) : null}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={!asset.allowed}
                    onClick={() => {
                      if (!asset.allowed) {
                        return;
                      }
                      onApplyReuse(asset.assetId);
                    }}
                    style={{
                      ...primaryButtonStyle,
                      opacity: asset.allowed ? 1 : 0.45,
                      cursor: asset.allowed ? "pointer" : "not-allowed",
                    }}
                  >
                    {t("reuse.actions.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAssetProvenance(asset.assetId);
                    }}
                    style={buttonStyle}
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
