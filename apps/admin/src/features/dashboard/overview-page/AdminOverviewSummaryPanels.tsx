import { useEffect, useId, useState } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { AdminOverviewViewModel, RecentChangeSummary } from "../overview";
import {
  formatCurrency,
  getFeedbackPalette,
  metricStyle,
  panelStyle,
  type FeedbackMessage,
} from "./shared";

function recentChangePalette(tone: RecentChangeSummary["tone"]) {
  if (tone === "success") {
    return {
      background: "rgba(15, 118, 110, 0.08)",
      borderLeft: "4px solid #0f766e",
      color: "#115e59",
    };
  }
  if (tone === "warning") {
    return {
      background: "rgba(245, 158, 11, 0.12)",
      borderLeft: "4px solid #b45309",
      color: "#92400e",
    };
  }
  return {
    background: "rgba(59, 130, 246, 0.1)",
    borderLeft: "4px solid #2563eb",
    color: "#1d4ed8",
  };
}

function renderRecentChangeTitle(change: RecentChangeSummary, t: AdminTranslator) {
  if (change.kind === "billing") {
    return t("changes.kind.billing");
  }
  if (change.kind === "evaluation") {
    return t("changes.kind.evaluation");
  }
  return t("changes.kind.review");
}

function renderRecentChangeDetail(change: RecentChangeSummary, t: AdminTranslator) {
  if (change.kind === "billing") {
    return t("changes.detail.billing", {
      eventType: change.eventType ?? "pending",
      amount: formatCurrency(change.amountCents ?? 0),
    });
  }
  if (change.kind === "evaluation") {
    return t("changes.detail.evaluation", {
      status: change.status ?? "pending",
      count: change.failedChecksCount ?? 0,
    });
  }
  return t("changes.detail.review", {
    conclusion: change.conclusion ?? "pending",
  });
}

export function AdminOverviewSummaryPanels({
  overview,
  t,
  onUpdateBudgetLimit,
  budgetFeedback,
}: {
  overview: AdminOverviewViewModel;
  t: AdminTranslator;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  budgetFeedback?: FeedbackMessage;
}) {
  const latestEvaluation = overview.evaluationRuns[0];
  const budgetInputId = useId();
  const [budgetLimitYuan, setBudgetLimitYuan] = useState(
    (overview.budgetSnapshot.limitCents / 100).toFixed(2),
  );

  useEffect(() => {
    setBudgetLimitYuan((overview.budgetSnapshot.limitCents / 100).toFixed(2));
  }, [overview.budgetSnapshot.limitCents]);

  return (
    <>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("budget.panel.title")}
          </h2>
          <p style={metricStyle}>
            {t("budget.limit", { amount: formatCurrency(overview.budgetSnapshot.limitCents) })}
          </p>
          <p style={metricStyle}>
            {t("budget.reserved", { amount: formatCurrency(overview.budgetSnapshot.reservedCents) })}
          </p>
          <p style={metricStyle}>
            {t("budget.remaining", {
              amount: formatCurrency(overview.budgetSnapshot.remainingBudgetCents),
            })}
          </p>
          <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
            <label htmlFor={budgetInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
              {t("budget.input.label")}
            </label>
            <input
              id={budgetInputId}
              type="number"
              min="0"
              step="0.01"
              value={budgetLimitYuan}
              onChange={(event) => {
                setBudgetLimitYuan(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
            <button
              type="button"
              style={{
                border: 0,
                borderRadius: "999px",
                padding: "10px 16px",
                background: "#0f766e",
                color: "#ecfeff",
                cursor: "pointer",
                justifySelf: "start",
              }}
              onClick={() => {
                if (!onUpdateBudgetLimit) {
                  return;
                }
                onUpdateBudgetLimit({
                  projectId: overview.budgetSnapshot.projectId,
                  limitCents: Math.round(Number(budgetLimitYuan || "0") * 100),
                });
              }}
            >
              {t("budget.button.update")}
            </button>
            {budgetFeedback ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  ...getFeedbackPalette(budgetFeedback),
                }}
              >
                {budgetFeedback.message}
              </p>
            ) : null}
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("billing.panel.title")}
          </h2>
          <p style={metricStyle}>
            {t("billing.usageRecordsCount", { count: overview.usageRecords.length })}
          </p>
          <p style={metricStyle}>
            {t("billing.eventsCount", { count: overview.billingEvents.length })}
          </p>
          <p style={metricStyle}>
            {t("billing.latestEvent", {
              eventType: overview.billingEvents[0]?.eventType ?? "pending",
            })}
          </p>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("review.panel.title")}
          </h2>
          <p style={metricStyle}>
            {t("review.conclusion", {
              conclusion: overview.reviewSummary.latestConclusion,
            })}
          </p>
          <p style={metricStyle}>
            {t("review.latestEvaluation", {
              status: latestEvaluation?.status ?? "pending",
            })}
          </p>
          <p style={metricStyle}>
            {t("review.failedChecks", { count: latestEvaluation?.failedChecks.length ?? 0 })}
          </p>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("changes.panel.title")}
          </h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {overview.recentChanges.map((change) => (
              <article
                key={change.id}
                style={{
                  display: "grid",
                  gap: "4px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  ...recentChangePalette(change.tone),
                }}
              >
                <strong>{renderRecentChangeTitle(change, t)}</strong>
                <span>{renderRecentChangeDetail(change, t)}</span>
              </article>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("usage.panel.title")}
          </h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {overview.usageRecords.map((record) => (
              <article
                key={record.id}
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
                <span>{record.meter}</span>
                <strong>{formatCurrency(record.amountCents)}</strong>
              </article>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
            {t("reviews.panel.title")}
          </h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {overview.shotReviews.map((review) => (
              <article
                key={review.id}
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
                <span>{review.id}</span>
                <strong>{review.conclusion}</strong>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
