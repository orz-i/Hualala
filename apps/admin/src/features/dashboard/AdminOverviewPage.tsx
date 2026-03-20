import { useEffect, useId, useState, type CSSProperties } from "react";

type BudgetSnapshot = {
  projectId: string;
  limitCents: number;
  reservedCents: number;
  remainingBudgetCents: number;
};

type UsageRecordSummary = {
  id: string;
  meter: string;
  amountCents: number;
};

type BillingEventSummary = {
  id: string;
  eventType: string;
  amountCents: number;
};

type ReviewSummary = {
  shotExecutionId: string;
  latestConclusion: string;
};

type EvaluationRunSummary = {
  id: string;
  status: string;
  failedChecks: string[];
};

type ShotReviewSummary = {
  id: string;
  conclusion: string;
};

type RecentChangeSummary = {
  id: string;
  kind: "billing" | "evaluation" | "review";
  title: string;
  detail: string;
  tone: "info" | "success" | "warning";
};

export type AdminOverviewViewModel = {
  budgetSnapshot: BudgetSnapshot;
  usageRecords: UsageRecordSummary[];
  billingEvents: BillingEventSummary[];
  reviewSummary: ReviewSummary;
  evaluationRuns: EvaluationRunSummary[];
  shotReviews: ShotReviewSummary[];
  recentChanges: RecentChangeSummary[];
};

type BudgetFeedback = {
  tone: "pending" | "success" | "error";
  message: string;
};

type AdminOverviewPageProps = {
  overview: AdminOverviewViewModel;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  budgetFeedback?: BudgetFeedback;
};

const panelStyle: CSSProperties = {
  borderRadius: "22px",
  padding: "22px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(232,244,247,0.9))",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.08)",
};

const metricStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "0.95rem",
};

function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

export function AdminOverviewPage({
  overview,
  onUpdateBudgetLimit,
  budgetFeedback,
}: AdminOverviewPageProps) {
  const latestEvaluation = overview.evaluationRuns[0];
  const budgetInputId = useId();
  const [budgetLimitYuan, setBudgetLimitYuan] = useState(
    (overview.budgetSnapshot.limitCents / 100).toFixed(2),
  );
  const budgetFeedbackPalette =
    budgetFeedback?.tone === "error"
      ? { color: "#991b1b" }
      : budgetFeedback?.tone === "pending"
        ? { color: "#92400e" }
        : { color: "#115e59" };

  useEffect(() => {
    setBudgetLimitYuan((overview.budgetSnapshot.limitCents / 100).toFixed(2));
  }, [overview.budgetSnapshot.limitCents]);

  const recentChangePalette = (tone: RecentChangeSummary["tone"]) =>
    tone === "success"
      ? {
          background: "rgba(15, 118, 110, 0.08)",
          borderLeft: "4px solid #0f766e",
          color: "#115e59",
        }
      : tone === "warning"
        ? {
            background: "rgba(245, 158, 11, 0.12)",
            borderLeft: "4px solid #b45309",
            color: "#92400e",
          }
        : {
            background: "rgba(59, 130, 246, 0.1)",
            borderLeft: "4px solid #2563eb",
            color: "#1d4ed8",
          };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "radial-gradient(circle at top right, rgba(16, 185, 129, 0.18), transparent 32%), linear-gradient(135deg, #f8fafc, #ecfeff 52%, #dbeafe)",
        color: "#0f172a",
        fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          display: "grid",
          gap: "20px",
        }}
      >
        <header style={panelStyle}>
          <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#0f766e" }}>
            Admin Overview
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>
            {overview.budgetSnapshot.projectId}
          </h1>
          <p style={{ margin: 0, color: "#334155" }}>
            镜头执行 <strong>{overview.reviewSummary.shotExecutionId}</strong> 当前评审结论为{" "}
            <strong>{overview.reviewSummary.latestConclusion}</strong>
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>预算概览</h2>
            <p style={metricStyle}>预算上限：{formatCurrency(overview.budgetSnapshot.limitCents)}</p>
            <p style={metricStyle}>已预占：{formatCurrency(overview.budgetSnapshot.reservedCents)}</p>
            <p style={metricStyle}>剩余额度：{formatCurrency(overview.budgetSnapshot.remainingBudgetCents)}</p>
            <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
              <label htmlFor={budgetInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
                预算上限（元）
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
                更新预算
              </button>
              {budgetFeedback ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    ...budgetFeedbackPalette,
                  }}
                >
                  {budgetFeedback.message}
                </p>
              ) : null}
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>计费观测</h2>
            <p style={metricStyle}>{overview.usageRecords.length} 条用量记录</p>
            <p style={metricStyle}>{overview.billingEvents.length} 条计费事件</p>
            <p style={metricStyle}>
              最近事件：{overview.billingEvents[0]?.eventType ?? "pending"}
            </p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>评审摘要</h2>
            <p style={metricStyle}>结论：{overview.reviewSummary.latestConclusion}</p>
            <p style={metricStyle}>最近评估：{latestEvaluation?.status ?? "pending"}</p>
            <p style={metricStyle}>失败检查：{latestEvaluation?.failedChecks.length ?? 0}</p>
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>最近变更</h2>
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
                  <strong>{change.title}</strong>
                  <span>{change.detail}</span>
                </article>
              ))}
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>用量记录</h2>
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>评审记录</h2>
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
      </section>
    </main>
  );
}
