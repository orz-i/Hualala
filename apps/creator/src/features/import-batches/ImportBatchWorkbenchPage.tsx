import type { CSSProperties } from "react";
import type { CreatorTranslator, LocaleCode } from "../../i18n";
import { ActionFeedback, type ActionFeedbackModel } from "../shared/ActionFeedback";

type ImportBatchSummary = {
  id: string;
  orgId: string;
  projectId: string;
  status: string;
  sourceType: string;
};

type UploadSessionSummary = {
  id: string;
  fileName: string;
  checksum: string;
  sizeBytes: number;
  retryCount: number;
  status: string;
  resumeHint: string;
};

type ImportBatchItemSummary = {
  id: string;
  status: string;
  assetId: string;
};

type CandidateAssetSummary = {
  id: string;
  assetId: string;
};

type ShotExecutionSummary = {
  id: string;
  status: string;
  primaryAssetId: string;
};

export type ImportBatchWorkbenchViewModel = {
  importBatch: ImportBatchSummary;
  uploadSessions: UploadSessionSummary[];
  items: ImportBatchItemSummary[];
  candidateAssets: CandidateAssetSummary[];
  shotExecutions: ShotExecutionSummary[];
};

export type SelectedUploadFileViewModel = {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  checksum: string;
};

type ImportBatchWorkbenchPageProps = {
  workbench: ImportBatchWorkbenchViewModel;
  locale: LocaleCode;
  t: CreatorTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  selectedUploadFile?: SelectedUploadFileViewModel | null;
  onChooseUploadFile?: (file: File | null) => void;
  onRegisterSelectedUpload?: () => void;
  onRetryUploadSession?: (sessionId: string) => void;
  onConfirmMatches?: (input: { importBatchId: string; itemIds: string[] }) => void;
  onSelectPrimaryAsset?: (input: {
    shotExecutionId: string;
    assetId: string;
  }) => void;
  feedback?: ActionFeedbackModel;
};

const panelStyle: CSSProperties = {
  borderRadius: "20px",
  padding: "20px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(237,244,255,0.9))",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
};

const metricStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#475569",
};

export function ImportBatchWorkbenchPage({
  workbench,
  locale,
  t,
  onLocaleChange,
  selectedUploadFile,
  onChooseUploadFile,
  onRegisterSelectedUpload,
  onRetryUploadSession,
  onConfirmMatches,
  onSelectPrimaryAsset,
  feedback,
}: ImportBatchWorkbenchPageProps) {
  const currentExecution = workbench.shotExecutions[0];
  const currentItem = workbench.items[0];
  const currentCandidate = workbench.candidateAssets[0];
  const latestUploadSession = workbench.uploadSessions.at(-1);
  const latestExpiredUploadSession = [...workbench.uploadSessions]
    .reverse()
    .find((session) => session.status === "expired");

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 28%), linear-gradient(135deg, #f8fafc, #e0f2fe 55%, #dbeafe)",
        color: "#0f172a",
        fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "grid",
          gap: "20px",
        }}
      >
        <header style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#1d4ed8",
              }}
            >
              {t("import.badge")}
            </p>
            <label style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}>
              <span>{t("locale.label")}</span>
              <select
                data-testid="ui-locale-select"
                value={locale}
                onChange={(event) => {
                  onLocaleChange(event.target.value as LocaleCode);
                }}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.45)",
                  padding: "8px 10px",
                  font: "inherit",
                  background: "#ffffff",
                }}
              >
                <option value="zh-CN">{t("locale.option.zh-CN")}</option>
                <option value="en-US">{t("locale.option.en-US")}</option>
              </select>
            </label>
          </div>
          <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>
            {workbench.importBatch.id}
          </h1>
          <p style={{ margin: 0, color: "#334155" }}>
            {t("import.header", {
              status: workbench.importBatch.status,
              sourceType: workbench.importBatch.sourceType,
            })}
          </p>
          {feedback ? <ActionFeedback feedback={feedback} /> : null}
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("import.upload.title")}
            </h2>
            <p style={metricStyle}>{t("import.upload.count", { count: workbench.uploadSessions.length })}</p>
            <p style={metricStyle}>
              {t("import.upload.latestStatus", {
                status: latestUploadSession?.status ?? "pending",
              })}
            </p>
            {latestExpiredUploadSession?.resumeHint ? (
              <p style={metricStyle}>
                {t("import.upload.expiredHint", {
                  hint: latestExpiredUploadSession.resumeHint,
                })}
              </p>
            ) : null}
            <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
              <label
                htmlFor="creator-upload-file-input"
                style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
              >
                <span>{t("import.upload.fileLabel")}</span>
                <input
                  id="creator-upload-file-input"
                  type="file"
                  onChange={(event) => {
                    onChooseUploadFile?.(event.target.files?.[0] ?? null);
                  }}
                />
              </label>
              {selectedUploadFile ? (
                <div style={{ display: "grid", gap: "6px" }}>
                  <p style={metricStyle}>
                    {t("import.upload.selectedName", {
                      fileName: selectedUploadFile.fileName,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("import.upload.selectedSize", {
                      sizeBytes: selectedUploadFile.sizeBytes,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("import.upload.selectedMimeType", {
                      mimeType: selectedUploadFile.mimeType,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("import.upload.selectedDimensions", {
                      width: selectedUploadFile.width,
                      height: selectedUploadFile.height,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("import.upload.selectedChecksum", {
                      checksum: selectedUploadFile.checksum,
                    })}
                  </p>
                </div>
              ) : (
                <p style={metricStyle}>{t("import.upload.selectedEmpty")}</p>
              )}
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "10px 16px",
                  background: "#7c3aed",
                  color: "#f5f3ff",
                  cursor: onRegisterSelectedUpload && selectedUploadFile ? "pointer" : "not-allowed",
                  opacity: onRegisterSelectedUpload && selectedUploadFile ? 1 : 0.55,
                }}
                disabled={!onRegisterSelectedUpload || !selectedUploadFile}
                onClick={() => {
                  onRegisterSelectedUpload?.();
                }}
              >
                {t("import.actions.registerUpload")}
              </button>
              <button
                type="button"
                style={{
                  borderRadius: "999px",
                  border: "1px solid rgba(124, 58, 237, 0.3)",
                  padding: "10px 16px",
                  background: "#faf5ff",
                  color: "#6d28d9",
                  cursor: latestExpiredUploadSession && onRetryUploadSession ? "pointer" : "not-allowed",
                  opacity: latestExpiredUploadSession && onRetryUploadSession ? 1 : 0.55,
                }}
                disabled={!latestExpiredUploadSession || !onRetryUploadSession}
                onClick={() => {
                  if (!latestExpiredUploadSession) {
                    return;
                  }
                  onRetryUploadSession?.(latestExpiredUploadSession.id);
                }}
              >
                {t("import.actions.retryLatestExpiredUpload")}
              </button>
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("import.matching.title")}
            </h2>
            <p style={metricStyle}>{t("import.matching.candidateCount", { count: workbench.candidateAssets.length })}</p>
            <p style={metricStyle}>{t("import.matching.itemCount", { count: workbench.items.length })}</p>
            <button
              type="button"
              style={{
                marginTop: "16px",
                border: 0,
                borderRadius: "999px",
                padding: "10px 16px",
                background: "#1d4ed8",
                color: "#eff6ff",
                cursor: "pointer",
              }}
              onClick={() => {
                if (!currentItem || !onConfirmMatches) {
                  return;
                }
                onConfirmMatches({
                  importBatchId: workbench.importBatch.id,
                  itemIds: [currentItem.id],
                });
              }}
            >
              {t("import.actions.confirmMatches")}
            </button>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("import.execution.title")}
            </h2>
            <p style={metricStyle}>
              <strong>{currentExecution?.status ?? "pending"}</strong>
            </p>
            <p style={metricStyle}>
              {t("import.execution.primaryAsset", {
                assetId:
                  currentExecution?.primaryAssetId || t("import.execution.primaryAsset.empty"),
              })}
            </p>
            <button
              type="button"
              style={{
                marginTop: "16px",
                border: 0,
                borderRadius: "999px",
                padding: "10px 16px",
                background: "#0f766e",
                color: "#ecfeff",
                cursor: "pointer",
              }}
              onClick={() => {
                if (!currentExecution || !currentCandidate || !onSelectPrimaryAsset) {
                  return;
                }
                onSelectPrimaryAsset({
                  shotExecutionId: currentExecution.id,
                  assetId: currentCandidate.assetId,
                });
              }}
            >
              {t("import.actions.selectPrimaryAsset")}
            </button>
          </article>
        </section>
      </section>
    </main>
  );
}
