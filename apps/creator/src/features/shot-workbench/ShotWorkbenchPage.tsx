import type { CSSProperties } from "react";
import type { CreatorTranslator, LocaleCode } from "../../i18n";
import { ActionFeedback, type ActionFeedbackModel } from "../shared/ActionFeedback";
import { AssetProvenanceDialog } from "../shared/AssetProvenanceDialog";
import type { AssetProvenanceDetailViewModel } from "../shared/assetProvenance";

type CandidateAssetSummary = {
  id: string;
  assetId: string;
  shotExecutionId: string;
  sourceRunId: string;
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
  provider: string;
  currentStep: string;
  attemptCount: number;
  lastError: string;
  externalRequestId: string;
};

type WorkflowStepSummary = {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  errorCode: string;
  errorMessage: string;
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
  workflowSteps: WorkflowStepSummary[];
  detailUnavailableMessage?: string;
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
  onSelectPrimaryAsset?: (input: {
    shotExecutionId: string;
    assetId: string;
  }) => void;
  assetProvenanceDetail?: AssetProvenanceDetailViewModel | null;
  assetProvenancePending?: boolean;
  assetProvenanceErrorMessage?: string;
  onOpenAssetProvenance?: (assetId: string) => void;
  onCloseAssetProvenance?: () => void;
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
  onSelectPrimaryAsset,
  assetProvenanceDetail,
  assetProvenancePending,
  assetProvenanceErrorMessage,
  onOpenAssetProvenance,
  onCloseAssetProvenance,
  onRetryWorkflowRun,
  feedback,
}: ShotWorkbenchPageProps) {
  const latestEvaluationStatus = workbench.latestEvaluationRun?.status ?? "pending";
  const latestWorkflowRun = workflowPanel?.latestWorkflowRun;
  const workflowSteps = workflowPanel?.workflowSteps ?? [];
  const workflowDetailUnavailableMessage = workflowPanel?.detailUnavailableMessage;
  const isWorkflowRunning = latestWorkflowRun?.status === "running";
  const isWorkflowRetryable = latestWorkflowRun?.status === "failed";
  const reviewTimeline = workbench.reviewTimeline;
  const hasReviewTimeline =
    reviewTimeline.evaluationRuns.length > 0 || reviewTimeline.shotReviews.length > 0;
  const primaryAssetId = workbench.shotExecution.primaryAssetId;

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
                <p style={metricStyle}>
                  {t("shot.workflow.provider", { provider: latestWorkflowRun.provider || t("shot.timeline.none") })}
                </p>
                <p style={metricStyle}>
                  {t("shot.workflow.currentStep", {
                    currentStep: latestWorkflowRun.currentStep || t("shot.timeline.none"),
                  })}
                </p>
                <p style={metricStyle}>
                  {t("shot.workflow.attemptCount", { count: latestWorkflowRun.attemptCount })}
                </p>
                <p style={metricStyle}>
                  {t("shot.workflow.lastError", {
                    message: latestWorkflowRun.lastError || t("shot.timeline.none"),
                  })}
                </p>
                <p style={metricStyle}>
                  {t("shot.workflow.externalRequestId", {
                    externalRequestId:
                      latestWorkflowRun.externalRequestId || t("shot.timeline.none"),
                  })}
                </p>
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
            {latestWorkflowRun ? (
              <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{t("shot.workflow.stepsTitle")}</h3>
                {workflowDetailUnavailableMessage ? (
                  <p style={metricStyle}>{workflowDetailUnavailableMessage}</p>
                ) : workflowSteps.length === 0 ? (
                  <p style={metricStyle}>{t("shot.workflow.stepsEmpty")}</p>
                ) : (
                  workflowSteps.map((step, index) => (
                    <article
                      key={step.id || `${step.workflowRunId}-${index}`}
                      style={{
                        display: "grid",
                        gap: "6px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "rgba(255, 255, 255, 0.82)",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                      }}
                    >
                      <strong>
                        {t("shot.workflow.stepKey", {
                          stepKey: step.stepKey || `step-${step.stepOrder || index + 1}`,
                        })}
                      </strong>
                      <p style={metricStyle}>
                        {t("shot.workflow.stepStatus", {
                          status: step.status || t("shot.timeline.none"),
                        })}
                      </p>
                      <p style={metricStyle}>
                        {t("shot.workflow.stepErrorCode", {
                          errorCode: step.errorCode || t("shot.timeline.none"),
                        })}
                      </p>
                      <p style={metricStyle}>
                        {t("shot.workflow.stepErrorMessage", {
                          errorMessage: step.errorMessage || t("shot.timeline.none"),
                        })}
                      </p>
                    </article>
                  ))
                )}
              </div>
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
          {workbench.candidateAssets.length === 0 ? (
            <p style={metricStyle}>{t("shot.list.empty")}</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {workbench.candidateAssets.map((candidate, index) => {
                const isPrimary =
                  Boolean(primaryAssetId) &&
                  Boolean(candidate.assetId) &&
                  candidate.assetId === primaryAssetId;
                const canSelectPrimary =
                  Boolean(onSelectPrimaryAsset) &&
                  Boolean(candidate.assetId) &&
                  !isPrimary;
                const canOpenAssetProvenance =
                  Boolean(onOpenAssetProvenance) && Boolean(candidate.assetId);

                return (
                  <article
                    key={candidate.id || index}
                    style={{
                      display: "grid",
                      gap: "10px",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      background: "rgba(255, 255, 255, 0.82)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <strong>
                      {t("shot.list.candidateId", {
                        id: candidate.id || `candidate-${index + 1}`,
                      })}
                    </strong>
                    <p style={metricStyle}>
                      {t("shot.list.assetId", {
                        assetId: candidate.assetId || t("shot.timeline.none"),
                      })}
                    </p>
                    <p style={metricStyle}>
                      {t("shot.list.sourceRunId", {
                        sourceRunId: candidate.sourceRunId || t("shot.timeline.none"),
                      })}
                    </p>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {isPrimary ? (
                        <strong style={{ color: "#0f766e", alignSelf: "center" }}>
                          {t("shot.list.primaryBadge")}
                        </strong>
                      ) : (
                        <button
                          type="button"
                          style={{
                            width: "fit-content",
                            border: 0,
                            borderRadius: "999px",
                            padding: "10px 16px",
                            background: "#0f766e",
                            color: "#ecfeff",
                            cursor: canSelectPrimary ? "pointer" : "not-allowed",
                            opacity: canSelectPrimary ? 1 : 0.55,
                          }}
                          disabled={!canSelectPrimary}
                          onClick={() => {
                            if (!canSelectPrimary) {
                              return;
                            }
                            onSelectPrimaryAsset?.({
                              shotExecutionId:
                                candidate.shotExecutionId || workbench.shotExecution.id,
                              assetId: candidate.assetId,
                            });
                          }}
                        >
                          {t("shot.actions.selectPrimaryAsset")}
                        </button>
                      )}
                      <button
                        type="button"
                        style={{
                          width: "fit-content",
                          borderRadius: "999px",
                          border: "1px solid rgba(15, 23, 42, 0.18)",
                          padding: "10px 16px",
                          background: "#ffffff",
                          color: "#0f172a",
                          cursor: canOpenAssetProvenance ? "pointer" : "not-allowed",
                          opacity: canOpenAssetProvenance ? 1 : 0.55,
                        }}
                        disabled={!canOpenAssetProvenance}
                        onClick={() => {
                          if (!candidate.assetId) {
                            return;
                          }
                          onOpenAssetProvenance?.(candidate.assetId);
                        }}
                      >
                        {t("asset.provenance.button")}
                      </button>
                    </div>
                  </article>
                );
              })}
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
      </section>
    </main>
  );
}
