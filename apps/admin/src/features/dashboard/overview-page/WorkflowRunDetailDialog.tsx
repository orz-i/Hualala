import { useId, useRef } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { WorkflowRunDetailViewModel } from "../workflow";
import {
  actionButtonBaseStyle,
  actionButtonToneStyles,
  formatDateTime,
  getFeedbackPalette,
  metricStyle,
  type FeedbackMessage,
} from "./shared";
import { useDialogAccessibility } from "./useDialogAccessibility";

export function WorkflowRunDetailDialog({
  workflowRunDetail,
  workflowActionFeedback,
  workflowActionPending,
  onRetryWorkflowRun,
  onCancelWorkflowRun,
  onCloseWorkflowDetail,
  t,
}: {
  workflowRunDetail: WorkflowRunDetailViewModel;
  workflowActionFeedback?: FeedbackMessage;
  workflowActionPending?: boolean;
  onRetryWorkflowRun?: (workflowRunId: string) => void;
  onCancelWorkflowRun?: (workflowRunId: string) => void;
  onCloseWorkflowDetail?: () => void;
  t: AdminTranslator;
}) {
  const workflowDetailTitleId = useId();
  const workflowDialogRef = useRef<HTMLElement | null>(null);
  const workflowCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useDialogAccessibility({
    open: true,
    dialogRef: workflowDialogRef,
    closeButtonRef: workflowCloseButtonRef,
    onClose: onCloseWorkflowDetail,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={workflowDetailTitleId}
        ref={workflowDialogRef}
        tabIndex={-1}
        style={{
          width: "min(820px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          borderRadius: "24px",
          padding: "24px",
          background: "#f8fafc",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.2)",
          display: "grid",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <h2 id={workflowDetailTitleId} style={{ margin: 0 }}>
              {t("workflow.detail.title")}
            </h2>
            <p style={metricStyle}>{workflowRunDetail.run.id}</p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {workflowRunDetail.run.status === "failed" ? (
              <button
                type="button"
                disabled={workflowActionPending}
                onClick={() => {
                  onRetryWorkflowRun?.(workflowRunDetail.run.id);
                }}
                style={{
                  ...actionButtonBaseStyle,
                  ...(workflowActionPending
                    ? actionButtonToneStyles.pending
                    : actionButtonToneStyles.retry),
                }}
              >
                {t("workflow.action.retry.button")}
              </button>
            ) : null}
            {workflowRunDetail.run.status === "running" ? (
              <button
                type="button"
                disabled={workflowActionPending}
                onClick={() => {
                  onCancelWorkflowRun?.(workflowRunDetail.run.id);
                }}
                style={{
                  ...actionButtonBaseStyle,
                  ...(workflowActionPending
                    ? actionButtonToneStyles.pending
                    : actionButtonToneStyles.cancel),
                }}
              >
                {t("workflow.action.cancel.button")}
              </button>
            ) : null}
            <button
              type="button"
              ref={workflowCloseButtonRef}
              aria-label={t("workflow.detail.close")}
              onClick={() => {
                onCloseWorkflowDetail?.();
              }}
              style={{
                ...actionButtonBaseStyle,
                ...actionButtonToneStyles.close,
              }}
            >
              {t("workflow.detail.close")}
            </button>
          </div>
        </div>
        {workflowActionFeedback ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              ...getFeedbackPalette(workflowActionFeedback),
            }}
          >
            {workflowActionFeedback.message}
          </p>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <p style={metricStyle}>
            {t("workflow.detail.project", { projectId: workflowRunDetail.run.projectId })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.resource", { resourceId: workflowRunDetail.run.resourceId })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.provider", { provider: workflowRunDetail.run.provider })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.currentStep", { currentStep: workflowRunDetail.run.currentStep })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.attemptCount", { count: workflowRunDetail.run.attemptCount })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.lastError", {
              message: workflowRunDetail.run.lastError || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.externalRequest", {
              externalRequestId: workflowRunDetail.run.externalRequestId || "pending",
            })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.createdAt", {
              createdAt: formatDateTime(workflowRunDetail.run.createdAt),
            })}
          </p>
          <p style={metricStyle}>
            {t("workflow.detail.updatedAt", {
              updatedAt: formatDateTime(workflowRunDetail.run.updatedAt),
            })}
          </p>
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          {workflowRunDetail.steps.map((step) => (
            <article
              key={step.id}
              style={{
                display: "grid",
                gap: "6px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <strong>{step.stepKey}</strong>
              <p style={metricStyle}>
                {t("workflow.step.status", { status: step.status, order: step.stepOrder })}
              </p>
              <p style={metricStyle}>
                {t("workflow.step.errorCode", { errorCode: step.errorCode || "none" })}
              </p>
              <p style={metricStyle}>
                {t("workflow.step.errorMessage", {
                  errorMessage: step.errorMessage || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("workflow.step.startedAt", {
                  startedAt: formatDateTime(step.startedAt),
                })}
              </p>
              <p style={metricStyle}>
                {t("workflow.step.completedAt", {
                  completedAt: formatDateTime(step.completedAt),
                })}
              </p>
              <p style={metricStyle}>
                {t("workflow.step.failedAt", { failedAt: formatDateTime(step.failedAt) })}
              </p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
