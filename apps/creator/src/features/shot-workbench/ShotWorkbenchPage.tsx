import type { CSSProperties } from "react";
import type { CreatorTranslator, LocaleCode } from "../../i18n";
import { ActionFeedback, type ActionFeedbackModel } from "../shared/ActionFeedback";

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

type ShotReviewTimelineEvaluationRunSummary = {
  id: string;
  status: string;
  passedChecks: string[];
  failedChecks: string[];
};

type ShotReviewTimelineShotReviewSummary = {
  id: string;
  conclusion: string;
  commentLocale: string;
};

export type ShotReviewTimelineViewModel = {
  evaluationRuns: ShotReviewTimelineEvaluationRunSummary[];
  shotReviews: ShotReviewTimelineShotReviewSummary[];
  unavailableMessage?: string;
};

type WorkflowRunSummary = {
  id: string;
  workflowType: string;
  status: string;
  resourceId: string;
  projectId: string;
};

type ShotExecutionSummary = {
  id: string;
  shotId: string;
  orgId: string;
  projectId: string;
  status: string;
  primaryAssetId: string;
};

export type ShotWorkbenchViewModel = {
  shotExecution: ShotExecutionSummary;
  candidateAssets: CandidateAssetSummary[];
  reviewSummary: ReviewSummary;
  latestEvaluationRun?: EvaluationRunSummary;
  reviewTimeline: ShotReviewTimelineViewModel;
};

export type ShotWorkflowPanelViewModel = {
  latestWorkflowRun?: WorkflowRunSummary;
};

export type ShotWorkbenchPageProps = {
  workbench: ShotWorkbenchViewModel;
  workflowPanel?: ShotWorkflowPanelViewModel;
  locale: LocaleCode;
  t: CreatorTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  onRunSubmissionGateChecks?: (input: { shotExecutionId: string }) => void;
  onSubmitShotForReview?: (input: { shotExecutionId: string }) => void;
  onStartWorkflow?: (input: {
    shotExecutionId: string;
    projectId: string;
    orgId: string;
  }) => void;
  onRetryWorkflowRun?: (input: { workflowRunId: string }) => void;
  feedback?: ActionFeedbackModel;
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
  workflowPanel,
  locale,
  t,
  onLocaleChange,
  onRunSubmissionGateChecks,
  onSubmitShotForReview,
  onStartWorkflow,
  onRetryWorkflowRun,
  feedback,
}: ShotWorkbenchPageProps) {
  const latestEvaluationStatus = workbench.latestEvaluationRun?.status ?? "pending";
  const latestWorkflowRun = workflowPanel?.latestWorkflowRun;
  const isWorkflowRunning = latestWorkflowRun?.status === "running";
  const isWorkflowRetryable = latestWorkflowRun?.status === "failed";
  const reviewTimeline = workbench.reviewTimeline;
  const hasReviewTimeline =
    reviewTimeline.evaluationRuns.length > 0 || reviewTimeline.shotReviews.length > 0;

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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#92400e" }}>
              {t("shot.badge")}
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
          <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>{workbench.shotExecution.id}</h1>
          <p style={{ margin: 0, color: "#334155" }}>
            {t("shot.header", {
              shotId: workbench.shotExecution.shotId,
              status: workbench.shotExecution.status,
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
              {t("shot.candidates.title")}
            </h2>
            <p style={metricStyle}>
              {t("shot.candidates.count", { count: workbench.candidateAssets.length })}
            </p>
            <p style={metricStyle}>
              {t("shot.candidates.primaryAsset", {
                assetId: workbench.shotExecution.primaryAssetId,
              })}
            </p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("shot.review.title")}
            </h2>
            <p style={metricStyle}>
              <strong>{workbench.reviewSummary.latestConclusion || "pending"}</strong>
            </p>
            <p style={metricStyle}>
              {t("shot.review.latestEvaluation", { status: latestEvaluationStatus })}
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
                {t("shot.actions.runGateChecks")}
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
                {t("shot.actions.submitReview")}
              </button>
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("shot.workflow.title")}</h2>
            {latestWorkflowRun ? (
              <>
                <p style={metricStyle}>{t("shot.workflow.id", { id: latestWorkflowRun.id })}</p>
                <p style={metricStyle}>
                  {t("shot.workflow.type", { workflowType: latestWorkflowRun.workflowType })}
                </p>
                <p style={metricStyle}>{t("shot.workflow.status", { status: latestWorkflowRun.status })}</p>
              </>
            ) : (
              <p style={metricStyle}>{t("shot.workflow.empty")}</p>
            )}
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "10px 16px",
                  background: "#1d4ed8",
                  color: "#eff6ff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  onStartWorkflow?.({
                    shotExecutionId: workbench.shotExecution.id,
                    projectId: workbench.shotExecution.projectId,
                    orgId: workbench.shotExecution.orgId,
                  });
                }}
              >
                {t("shot.actions.startWorkflow")}
              </button>
              {isWorkflowRetryable && latestWorkflowRun ? (
                <button
                  type="button"
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "10px 16px",
                    background: "#7c2d12",
                    color: "#fff7ed",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    onRetryWorkflowRun?.({
                      workflowRunId: latestWorkflowRun.id,
                    });
                  }}
                >
                  {t("shot.actions.retryWorkflow")}
                </button>
              ) : null}
            </div>
            {isWorkflowRunning ? (
              <p style={{ ...metricStyle, marginTop: "12px" }}>{t("shot.workflow.running")}</p>
            ) : null}
          </article>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("shot.timeline.title")}
          </h2>
          {reviewTimeline.unavailableMessage ? (
            <p style={metricStyle}>{reviewTimeline.unavailableMessage}</p>
          ) : !hasReviewTimeline ? (
            <p style={metricStyle}>{t("shot.timeline.empty")}</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
              }}
            >
              <section style={{ display: "grid", gap: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{t("shot.timeline.evaluations")}</h3>
                {reviewTimeline.evaluationRuns.length === 0 ? (
                  <p style={metricStyle}>{t("shot.timeline.empty")}</p>
                ) : (
                  reviewTimeline.evaluationRuns.map((run, index) => (
                    <article
                      key={`evaluation-${run.id || index}`}
                      style={{
                        display: "grid",
                        gap: "6px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "rgba(255, 255, 255, 0.82)",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                      }}
                    >
                      <strong>{run.id || `evaluation-${index + 1}`}</strong>
                      <p style={metricStyle}>
                        {t("shot.timeline.status", { status: run.status })}
                      </p>
                      <p style={metricStyle}>
                        {t("shot.timeline.passedChecks", {
                          checks: run.passedChecks.join(", ") || t("shot.timeline.none"),
                        })}
                      </p>
                      <p style={metricStyle}>
                        {t("shot.timeline.failedChecks", {
                          checks: run.failedChecks.join(", ") || t("shot.timeline.none"),
                        })}
                      </p>
                    </article>
                  ))
                )}
              </section>

              <section style={{ display: "grid", gap: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{t("shot.timeline.reviews")}</h3>
                {reviewTimeline.shotReviews.length === 0 ? (
                  <p style={metricStyle}>{t("shot.timeline.empty")}</p>
                ) : (
                  reviewTimeline.shotReviews.map((review, index) => (
                    <article
                      key={`review-${review.id || index}`}
                      style={{
                        display: "grid",
                        gap: "6px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "rgba(255, 255, 255, 0.82)",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                      }}
                    >
                      <strong>{review.id || `review-${index + 1}`}</strong>
                      <p style={metricStyle}>
                        {t("shot.timeline.conclusion", { conclusion: review.conclusion })}
                      </p>
                      <p style={metricStyle}>
                        {t("shot.timeline.commentLocale", {
                          locale: review.commentLocale || t("shot.timeline.none"),
                        })}
                      </p>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("shot.list.title")}</h2>
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
