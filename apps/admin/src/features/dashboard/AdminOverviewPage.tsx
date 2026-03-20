import { useEffect, useId, useState, type CSSProperties } from "react";
import type { AdminTranslator, LocaleCode } from "../../i18n";
import type { AdminGovernanceViewModel } from "./governance";

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

export type RecentChangeSummary = {
  id: string;
  kind: "billing" | "evaluation" | "review";
  tone: "info" | "success" | "warning";
  eventType?: string;
  amountCents?: number;
  status?: string;
  failedChecksCount?: number;
  conclusion?: string;
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
  governance: AdminGovernanceViewModel;
  locale: LocaleCode;
  t: AdminTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  onUpdateUserPreferences?: (input: {
    userId: string;
    displayLocale: string;
    timezone: string;
  }) => void;
  onUpdateMemberRole?: (input: { memberId: string; roleId: string }) => void;
  onUpdateOrgLocaleSettings?: (input: { defaultLocale: string }) => void;
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
  governance,
  locale,
  t,
  onLocaleChange,
  onUpdateBudgetLimit,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  budgetFeedback,
}: AdminOverviewPageProps) {
  const latestEvaluation = overview.evaluationRuns[0];
  const budgetInputId = useId();
  const displayLocaleInputId = useId();
  const timezoneInputId = useId();
  const orgLocaleInputId = useId();
  const [budgetLimitYuan, setBudgetLimitYuan] = useState(
    (overview.budgetSnapshot.limitCents / 100).toFixed(2),
  );
  const [displayLocale, setDisplayLocale] = useState(governance.userPreferences.displayLocale);
  const [timezone, setTimezone] = useState(governance.userPreferences.timezone);
  const [orgDefaultLocale, setOrgDefaultLocale] = useState(
    governance.orgLocaleSettings.defaultLocale,
  );
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(governance.members.map((member) => [member.memberId, member.roleId])),
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

  useEffect(() => {
    setDisplayLocale(governance.userPreferences.displayLocale);
    setTimezone(governance.userPreferences.timezone);
  }, [governance.userPreferences.displayLocale, governance.userPreferences.timezone]);

  useEffect(() => {
    setOrgDefaultLocale(governance.orgLocaleSettings.defaultLocale);
  }, [governance.orgLocaleSettings.defaultLocale]);

  useEffect(() => {
    setMemberRoleDrafts(
      Object.fromEntries(governance.members.map((member) => [member.memberId, member.roleId])),
    );
  }, [governance.members]);

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

  const renderRecentChangeTitle = (change: RecentChangeSummary) => {
    if (change.kind === "billing") {
      return t("changes.kind.billing");
    }
    if (change.kind === "evaluation") {
      return t("changes.kind.evaluation");
    }
    return t("changes.kind.review");
  };

  const renderRecentChangeDetail = (change: RecentChangeSummary) => {
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#0f766e" }}>
              {t("app.badge")}
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
            {overview.budgetSnapshot.projectId}
          </h1>
          <p style={{ margin: 0, color: "#334155" }}>
            {t("app.summary", {
              shotExecutionId: overview.reviewSummary.shotExecutionId,
              latestConclusion: overview.reviewSummary.latestConclusion,
            })}
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("budget.panel.title")}</h2>
            <p style={metricStyle}>{t("budget.limit", { amount: formatCurrency(overview.budgetSnapshot.limitCents) })}</p>
            <p style={metricStyle}>{t("budget.reserved", { amount: formatCurrency(overview.budgetSnapshot.reservedCents) })}</p>
            <p style={metricStyle}>{t("budget.remaining", { amount: formatCurrency(overview.budgetSnapshot.remainingBudgetCents) })}</p>
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
                    ...budgetFeedbackPalette,
                  }}
                >
                  {budgetFeedback.message}
                </p>
              ) : null}
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("billing.panel.title")}</h2>
            <p style={metricStyle}>{t("billing.usageRecordsCount", { count: overview.usageRecords.length })}</p>
            <p style={metricStyle}>{t("billing.eventsCount", { count: overview.billingEvents.length })}</p>
            <p style={metricStyle}>
              {t("billing.latestEvent", {
                eventType: overview.billingEvents[0]?.eventType ?? "pending",
              })}
            </p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("review.panel.title")}</h2>
            <p style={metricStyle}>{t("review.conclusion", { conclusion: overview.reviewSummary.latestConclusion })}</p>
            <p style={metricStyle}>{t("review.latestEvaluation", { status: latestEvaluation?.status ?? "pending" })}</p>
            <p style={metricStyle}>{t("review.failedChecks", { count: latestEvaluation?.failedChecks.length ?? 0 })}</p>
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("changes.panel.title")}</h2>
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
                  <strong>{renderRecentChangeTitle(change)}</strong>
                  <span>{renderRecentChangeDetail(change)}</span>
                </article>
              ))}
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("usage.panel.title")}</h2>
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
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>{t("reviews.panel.title")}</h2>
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

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("governance.session.title")}
            </h2>
            <div style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
              <p style={metricStyle}>{t("governance.session.idLabel")}</p>
              <p style={metricStyle}>{governance.currentSession.sessionId}</p>
              <p style={metricStyle}>{t("governance.session.orgId", { orgId: governance.currentSession.orgId })}</p>
              <p style={metricStyle}>{t("governance.session.userId", { userId: governance.currentSession.userId })}</p>
              <p style={metricStyle}>{t("governance.session.locale", { locale: governance.currentSession.locale })}</p>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <label htmlFor={displayLocaleInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
                {t("governance.preferences.displayLocale")}
              </label>
              <input
                id={displayLocaleInputId}
                value={displayLocale}
                onChange={(event) => {
                  setDisplayLocale(event.target.value);
                }}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.45)",
                  padding: "10px 12px",
                  font: "inherit",
                }}
              />
              <label htmlFor={timezoneInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
                {t("governance.preferences.timezone")}
              </label>
              <input
                id={timezoneInputId}
                value={timezone}
                onChange={(event) => {
                  setTimezone(event.target.value);
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
                  background: "#1d4ed8",
                  color: "#eff6ff",
                  cursor: "pointer",
                  justifySelf: "start",
                }}
                onClick={() => {
                  onUpdateUserPreferences?.({
                    userId: governance.userPreferences.userId,
                    displayLocale,
                    timezone,
                  });
                }}
              >
                {t("governance.preferences.update")}
              </button>
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("governance.org.title")}
            </h2>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "10px" }}>
                {governance.members.map((member) => {
                  const draftRoleId = memberRoleDrafts[member.memberId] ?? member.roleId;
                  return (
                    <article
                      key={member.memberId}
                      style={{
                        display: "grid",
                        gap: "10px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "rgba(255, 255, 255, 0.82)",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                      }}
                    >
                      <p style={{ ...metricStyle, fontWeight: 600 }}>{member.userId}</p>
                      <select
                        value={draftRoleId}
                        onChange={(event) => {
                          setMemberRoleDrafts((current) => ({
                            ...current,
                            [member.memberId]: event.target.value,
                          }));
                        }}
                        style={{
                          borderRadius: "12px",
                          border: "1px solid rgba(148, 163, 184, 0.45)",
                          padding: "10px 12px",
                          font: "inherit",
                          background: "#ffffff",
                        }}
                      >
                        {governance.roles.map((role) => (
                          <option key={role.roleId} value={role.roleId}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
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
                          onUpdateMemberRole?.({
                            memberId: member.memberId,
                            roleId: draftRoleId,
                          });
                        }}
                      >
                        {t("governance.members.update")}
                      </button>
                    </article>
                  );
                })}
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                <label htmlFor={orgLocaleInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
                  {t("governance.locale.defaultLocale")}
                </label>
                <input
                  id={orgLocaleInputId}
                  value={orgDefaultLocale}
                  onChange={(event) => {
                    setOrgDefaultLocale(event.target.value);
                  }}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid rgba(148, 163, 184, 0.45)",
                    padding: "10px 12px",
                    font: "inherit",
                  }}
                />
                <p style={metricStyle}>
                  {t("governance.locale.supportedLocales", {
                    locales: governance.orgLocaleSettings.supportedLocales.join(", "),
                  })}
                </p>
                <button
                  type="button"
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "10px 16px",
                    background: "#7c3aed",
                    color: "#f5f3ff",
                    cursor: "pointer",
                    justifySelf: "start",
                  }}
                  onClick={() => {
                    onUpdateOrgLocaleSettings?.({
                      defaultLocale: orgDefaultLocale,
                    });
                  }}
                >
                  {t("governance.locale.update")}
                </button>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
