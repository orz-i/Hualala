import type { CSSProperties } from "react";

type CandidateAssetSummary = {
  id: string;
  assetId: string;
};

type ReviewSummary = {
  latestConclusion: string;
};

type EvaluationRunSummary = {
  id: string;
  status: string;
};

type ShotExecutionSummary = {
  id: string;
  shotId: string;
  status: string;
  primaryAssetId: string;
};

export type ShotWorkbenchViewModel = {
  shotExecution: ShotExecutionSummary;
  candidateAssets: CandidateAssetSummary[];
  reviewSummary: ReviewSummary;
  latestEvaluationRun?: EvaluationRunSummary;
};

type ShotWorkbenchFeedback = {
  tone: "success" | "error" | "pending";
  message: string;
  passedChecks?: string[];
  failedChecks?: string[];
  latestConclusion?: string;
  latestEvaluationStatus?: string;
};

type ShotWorkbenchPageProps = {
  workbench: ShotWorkbenchViewModel;
  onRunSubmissionGateChecks?: (input: { shotExecutionId: string }) => void;
  onSubmitShotForReview?: (input: { shotExecutionId: string }) => void;
  feedback?: ShotWorkbenchFeedback;
};

const panelStyle: CSSProperties = {
  borderRadius: "20px",
  padding: "20px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,243,235,0.92))",
  border: "1px solid rgba(31, 41, 55, 0.08)",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
};

const metricStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#475569",
};

export function ShotWorkbenchPage({
  workbench,
  onRunSubmissionGateChecks,
  onSubmitShotForReview,
  feedback,
}: ShotWorkbenchPageProps) {
  const latestEvaluationStatus = workbench.latestEvaluationRun?.status ?? "pending";
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
          "radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 30%), linear-gradient(135deg, #f8fafc, #f1f5f9 55%, #e2e8f0)",
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
          <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#92400e" }}>
            Creator Workbench
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>{workbench.shotExecution.id}</h1>
          <p style={{ margin: 0, color: "#334155" }}>
            Shot {workbench.shotExecution.shotId} 当前处于 <strong>{workbench.shotExecution.status}</strong>
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
              {feedback.passedChecks && feedback.passedChecks.length > 0 ? (
                <div style={{ marginTop: "10px" }}>
                  <strong>通过检查</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                    {feedback.passedChecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {feedback.failedChecks && feedback.failedChecks.length > 0 ? (
                <div style={{ marginTop: "10px" }}>
                  <strong>未通过检查</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                    {feedback.failedChecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {feedback.latestConclusion ? (
                <p style={{ margin: "10px 0 0" }}>最新评审结论：{feedback.latestConclusion}</p>
              ) : null}
              {feedback.latestEvaluationStatus ? (
                <p style={{ margin: "6px 0 0" }}>最近评估：{feedback.latestEvaluationStatus}</p>
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>候选素材</h2>
            <p style={metricStyle}>{workbench.candidateAssets.length} 个候选素材</p>
            <p style={metricStyle}>主素材：{workbench.shotExecution.primaryAssetId}</p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>评审结论</h2>
            <p style={metricStyle}>
              <strong>{workbench.reviewSummary.latestConclusion || "pending"}</strong>
            </p>
            <p style={metricStyle}>
              最近评估：<strong>{latestEvaluationStatus}</strong>
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "10px 16px",
                  background: "#b45309",
                  color: "#fffbeb",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!onRunSubmissionGateChecks) {
                    return;
                  }
                  onRunSubmissionGateChecks({
                    shotExecutionId: workbench.shotExecution.id,
                  });
                }}
              >
                Gate 检查
              </button>
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "10px 16px",
                  background: "#0f766e",
                  color: "#ecfeff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!onSubmitShotForReview) {
                    return;
                  }
                  onSubmitShotForReview({
                    shotExecutionId: workbench.shotExecution.id,
                  });
                }}
              >
                提交评审
              </button>
            </div>
          </article>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>候选清单</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {workbench.candidateAssets.map((candidate) => (
              <article
                key={candidate.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.82)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                }}
              >
                <span>{candidate.id}</span>
                <strong>{candidate.assetId}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
