import type { CSSProperties } from "react";

type ImportBatchSummary = {
  id: string;
  status: string;
  sourceType: string;
};

type UploadSessionSummary = {
  id: string;
  status: string;
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

type ImportBatchWorkbenchFeedback = {
  tone: "success" | "error" | "pending";
  message: string;
  latestImportBatchStatus?: string;
  latestShotExecutionStatus?: string;
  latestPrimaryAssetId?: string;
};

type ImportBatchWorkbenchPageProps = {
  workbench: ImportBatchWorkbenchViewModel;
  onConfirmMatches?: (input: { importBatchId: string; itemIds: string[] }) => void;
  onSelectPrimaryAsset?: (input: {
    shotExecutionId: string;
    assetId: string;
  }) => void;
  feedback?: ImportBatchWorkbenchFeedback;
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
  onConfirmMatches,
  onSelectPrimaryAsset,
  feedback,
}: ImportBatchWorkbenchPageProps) {
  const currentExecution = workbench.shotExecutions[0];
  const currentItem = workbench.items[0];
  const currentCandidate = workbench.candidateAssets[0];
  const feedbackPalette =
    feedback?.tone === "error"
      ? {
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(220, 38, 38, 0.24)",
          color: "#991b1b",
        }
      : feedback?.tone === "pending"
        ? {
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(180, 83, 9, 0.22)",
            color: "#92400e",
          }
        : {
            background: "rgba(15, 118, 110, 0.12)",
            border: "1px solid rgba(13, 148, 136, 0.2)",
            color: "#115e59",
          };

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
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#1d4ed8",
            }}
          >
            Import Workbench
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>
            {workbench.importBatch.id}
          </h1>
          <p style={{ margin: 0, color: "#334155" }}>
            当前状态 <strong>{workbench.importBatch.status}</strong>，来源{" "}
            <strong>{workbench.importBatch.sourceType}</strong>
          </p>
          {feedback ? (
            <div
              style={{
                margin: "16px 0 0",
                padding: "10px 14px",
                borderRadius: "14px",
                fontSize: "0.95rem",
                ...feedbackPalette,
              }}
            >
              <p style={{ margin: 0 }}>{feedback.message}</p>
              {feedback.latestImportBatchStatus ? (
                <p style={{ margin: "10px 0 0" }}>
                  当前批次状态：{feedback.latestImportBatchStatus}
                </p>
              ) : null}
              {feedback.latestShotExecutionStatus ? (
                <p style={{ margin: "6px 0 0" }}>
                  当前执行状态：{feedback.latestShotExecutionStatus}
                </p>
              ) : null}
              {feedback.latestPrimaryAssetId ? (
                <p style={{ margin: "6px 0 0" }}>
                  当前主素材：{feedback.latestPrimaryAssetId}
                </p>
              ) : null}
            </div>
          ) : null}
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
              上传会话
            </h2>
            <p style={metricStyle}>{workbench.uploadSessions.length} 个上传会话</p>
            <p style={metricStyle}>
              最近状态：<strong>{workbench.uploadSessions[0]?.status ?? "pending"}</strong>
            </p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              素材匹配
            </h2>
            <p style={metricStyle}>{workbench.candidateAssets.length} 个候选素材</p>
            <p style={metricStyle}>{workbench.items.length} 个批次条目</p>
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
              确认匹配
            </button>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              执行状态
            </h2>
            <p style={metricStyle}>
              <strong>{currentExecution?.status ?? "pending"}</strong>
            </p>
            <p style={metricStyle}>
              主素材：{currentExecution?.primaryAssetId || "未选择"}
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
              设为主素材
            </button>
          </article>
        </section>
      </section>
    </main>
  );
}
