import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { AdminTranslator, LocaleCode } from "../../i18n";
import type {
  AssetMonitorViewModel,
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "./assetMonitor";
import type { AdminGovernanceViewModel } from "./governance";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "./workflow";

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
  workflowMonitor: WorkflowMonitorViewModel;
  assetMonitor: AssetMonitorViewModel;
  workflowRunDetail?: WorkflowRunDetailViewModel | null;
  importBatchDetail?: ImportBatchDetailViewModel | null;
  assetProvenanceDetail?: AssetProvenanceDetailViewModel | null;
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
  onWorkflowStatusFilterChange?: (status: string) => void;
  onWorkflowTypeFilterChange?: (workflowType: string) => void;
  onAssetStatusFilterChange?: (status: string) => void;
  onAssetSourceTypeFilterChange?: (sourceType: string) => void;
  onSelectWorkflowRun?: (workflowRunId: string) => void;
  onSelectImportBatch?: (importBatchId: string) => void;
  onSelectAssetProvenance?: (assetId: string) => void;
  onCloseWorkflowDetail?: () => void;
  onCloseImportBatchDetail?: () => void;
  onCloseAssetProvenance?: () => void;
  budgetFeedback?: BudgetFeedback;
  governanceActionFeedback?: BudgetFeedback;
  governanceActionPending?: boolean;
  workflowActionFeedback?: BudgetFeedback;
  workflowActionPending?: boolean;
  assetActionFeedback?: BudgetFeedback;
  assetActionPending?: boolean;
  onCreateRole?: (input: {
    code: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onUpdateRole?: (input: {
    roleId: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onDeleteRole?: (input: { roleId: string }) => void;
  onRetryWorkflowRun?: (workflowRunId: string) => void;
  onCancelWorkflowRun?: (workflowRunId: string) => void;
  selectedImportItemIds?: string[];
  onToggleImportBatchItemSelection?: (input: {
    itemId: string;
    checked: boolean;
  }) => void;
  onConfirmImportBatchItem?: (input: { importBatchId: string; itemId: string }) => void;
  onConfirmSelectedImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onConfirmAllImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onSelectPrimaryAsset?: (input: { shotExecutionId: string; assetId: string }) => void;
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

const workflowActionButtonBaseStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "8px 14px",
};

const workflowActionButtonToneStyles = {
  retry: {
    background: "#b45309",
    color: "#fffbeb",
    cursor: "pointer",
  } satisfies CSSProperties,
  cancel: {
    background: "#991b1b",
    color: "#fef2f2",
    cursor: "pointer",
  } satisfies CSSProperties,
  pending: {
    background: "#94a3b8",
    cursor: "not-allowed",
  } satisfies CSSProperties,
  close: {
    background: "#cbd5e1",
    color: "#0f172a",
    cursor: "pointer",
  } satisfies CSSProperties,
  confirm: {
    background: "#0369a1",
    color: "#f0f9ff",
    cursor: "pointer",
  } satisfies CSSProperties,
  primary: {
    background: "#166534",
    color: "#f0fdf4",
    cursor: "pointer",
  } satisfies CSSProperties,
};

function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

function formatDateTime(value: string) {
  if (!value) {
    return "pending";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${sizeBytes} B`;
}

function listFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

function useDialogAccessibility({
  open,
  dialogRef,
  closeButtonRef,
  onClose,
}: {
  open: boolean;
  dialogRef: React.RefObject<HTMLElement | null>;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose?: () => void;
}) {
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = listFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) {
        return;
      }

      const activeElement = document.activeElement;
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [closeButtonRef, dialogRef, onClose, open]);
}

export function AdminOverviewPage({
  overview,
  governance,
  workflowMonitor,
  assetMonitor,
  workflowRunDetail,
  importBatchDetail,
  assetProvenanceDetail,
  locale,
  t,
  onLocaleChange,
  onUpdateBudgetLimit,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onAssetStatusFilterChange,
  onAssetSourceTypeFilterChange,
  onSelectWorkflowRun,
  onSelectImportBatch,
  onSelectAssetProvenance,
  onCloseWorkflowDetail,
  onCloseImportBatchDetail,
  onCloseAssetProvenance,
  budgetFeedback,
  governanceActionFeedback,
  governanceActionPending,
  workflowActionFeedback,
  workflowActionPending,
  assetActionFeedback,
  assetActionPending,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onRetryWorkflowRun,
  onCancelWorkflowRun,
  selectedImportItemIds = [],
  onToggleImportBatchItemSelection,
  onConfirmImportBatchItem,
  onConfirmSelectedImportBatchItems,
  onConfirmAllImportBatchItems,
  onSelectPrimaryAsset,
}: AdminOverviewPageProps) {
  const latestEvaluation = overview.evaluationRuns[0];
  const budgetInputId = useId();
  const displayLocaleInputId = useId();
  const timezoneInputId = useId();
  const orgLocaleInputId = useId();
  const workflowStatusFilterInputId = useId();
  const workflowTypeFilterInputId = useId();
  const assetStatusFilterInputId = useId();
  const assetSourceTypeFilterInputId = useId();
  const workflowDetailTitleId = useId();
  const assetDetailTitleId = useId();
  const assetProvenanceTitleId = useId();
  const workflowDialogRef = useRef<HTMLElement | null>(null);
  const workflowCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const assetDetailDialogRef = useRef<HTMLElement | null>(null);
  const assetDetailCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const assetProvenanceDialogRef = useRef<HTMLElement | null>(null);
  const assetProvenanceCloseButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDisplayName, setNewRoleDisplayName] = useState("");
  const [newRolePermissionCodes, setNewRolePermissionCodes] = useState<string[]>([]);
  const [roleDisplayNameDrafts, setRoleDisplayNameDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(governance.roles.map((role) => [role.roleId, role.displayName])),
  );
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      governance.roles.map((role) => [role.roleId, [...role.permissionCodes]]),
    ),
  );
  const budgetFeedbackPalette =
    budgetFeedback?.tone === "error"
      ? { color: "#991b1b" }
      : budgetFeedback?.tone === "pending"
        ? { color: "#92400e" }
        : { color: "#115e59" };
  const governanceFeedbackPalette =
    governanceActionFeedback?.tone === "error"
      ? { color: "#991b1b" }
      : governanceActionFeedback?.tone === "pending"
        ? { color: "#92400e" }
        : { color: "#115e59" };
  const workflowFeedbackPalette =
    workflowActionFeedback?.tone === "error"
      ? { color: "#991b1b" }
      : workflowActionFeedback?.tone === "pending"
        ? { color: "#92400e" }
        : { color: "#115e59" };
  const assetFeedbackPalette =
    assetActionFeedback?.tone === "error"
      ? { color: "#991b1b" }
      : assetActionFeedback?.tone === "pending"
        ? { color: "#92400e" }
        : { color: "#115e59" };
  const actionableImportItems = importBatchDetail
    ? importBatchDetail.items.filter((item) => item.status !== "confirmed" && Boolean(item.assetId))
    : [];
  const actionableImportItemIds = actionableImportItems.map((item) => item.id);
  const selectedActionableImportItemIds = selectedImportItemIds.filter((itemId) =>
    actionableImportItemIds.includes(itemId),
  );
  const canManageRoles = governance.capabilities.canManageRoles;
  const canManageMembers = governance.capabilities.canManageMembers;
  const canManageOrgSettings = governance.capabilities.canManageOrgSettings;
  const canManageUserPreferences = governance.capabilities.canManageUserPreferences;

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

  useEffect(() => {
    setRoleDisplayNameDrafts(
      Object.fromEntries(governance.roles.map((role) => [role.roleId, role.displayName])),
    );
    setRolePermissionDrafts(
      Object.fromEntries(
        governance.roles.map((role) => [role.roleId, [...role.permissionCodes]]),
      ),
    );
  }, [governance.roles]);

  useDialogAccessibility({
    open: Boolean(workflowRunDetail),
    dialogRef: workflowDialogRef,
    closeButtonRef: workflowCloseButtonRef,
    onClose: onCloseWorkflowDetail,
  });

  useDialogAccessibility({
    open: Boolean(importBatchDetail) && !assetProvenanceDetail,
    dialogRef: assetDetailDialogRef,
    closeButtonRef: assetDetailCloseButtonRef,
    onClose: onCloseImportBatchDetail,
  });

  useDialogAccessibility({
    open: Boolean(assetProvenanceDetail),
    dialogRef: assetProvenanceDialogRef,
    closeButtonRef: assetProvenanceCloseButtonRef,
    onClose: onCloseAssetProvenance,
  });

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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.05rem" }}>
                  {t("workflow.panel.title")}
                </h2>
                <p style={{ ...metricStyle, fontSize: "0.9rem" }}>
                  {t("workflow.panel.summary", { count: workflowMonitor.runs.length })}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "10px",
                  flex: "1 1 360px",
                }}
              >
                <label
                  htmlFor={workflowStatusFilterInputId}
                  style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
                >
                  <span>{t("workflow.filter.status")}</span>
                  <select
                    id={workflowStatusFilterInputId}
                    value={workflowMonitor.filters.status}
                    onChange={(event) => {
                      onWorkflowStatusFilterChange?.(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "8px 10px",
                      font: "inherit",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">{t("workflow.filter.option.all")}</option>
                    <option value="running">{t("workflow.filter.option.running")}</option>
                    <option value="failed">{t("workflow.filter.option.failed")}</option>
                    <option value="succeeded">{t("workflow.filter.option.succeeded")}</option>
                    <option value="cancelled">{t("workflow.filter.option.cancelled")}</option>
                  </select>
                </label>
                <label
                  htmlFor={workflowTypeFilterInputId}
                  style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
                >
                  <span>{t("workflow.filter.type")}</span>
                  <select
                    id={workflowTypeFilterInputId}
                    value={workflowMonitor.filters.workflowType}
                    onChange={(event) => {
                      onWorkflowTypeFilterChange?.(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "8px 10px",
                      font: "inherit",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">{t("workflow.filter.option.all")}</option>
                    <option value="shot_pipeline">shot_pipeline</option>
                  </select>
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              {workflowMonitor.runs.map((run) => (
                <article
                  key={run.id}
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.82)",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{run.id}</strong>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        borderRadius: "999px",
                        padding: "8px 14px",
                        background: "#0f766e",
                        color: "#ecfeff",
                        cursor: "pointer",
                      }}
                      aria-label={t("workflow.detail.button", { id: run.id })}
                      onClick={() => {
                        onSelectWorkflowRun?.(run.id);
                      }}
                    >
                      {t("workflow.detail.open")}
                    </button>
                  </div>
                  <p style={metricStyle}>
                    {t("workflow.run.summary", {
                      workflowType: run.workflowType,
                      status: run.status,
                      provider: run.provider,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("workflow.run.step", {
                      currentStep: run.currentStep,
                      attemptCount: run.attemptCount,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("workflow.run.updatedAt", {
                      updatedAt: formatDateTime(run.updatedAt),
                    })}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.05rem" }}>
                  {t("asset.panel.title")}
                </h2>
                <p style={{ ...metricStyle, fontSize: "0.9rem" }}>
                  {t("asset.panel.summary", { count: assetMonitor.importBatches.length })}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "10px",
                  flex: "1 1 360px",
                }}
              >
                <label
                  htmlFor={assetStatusFilterInputId}
                  style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
                >
                  <span>{t("asset.filter.status")}</span>
                  <select
                    id={assetStatusFilterInputId}
                    value={assetMonitor.filters.status}
                    onChange={(event) => {
                      onAssetStatusFilterChange?.(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "8px 10px",
                      font: "inherit",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">{t("asset.filter.option.all")}</option>
                    <option value="pending_review">{t("asset.filter.option.pendingReview")}</option>
                    <option value="matched_pending_confirm">
                      {t("asset.filter.option.matchedPendingConfirm")}
                    </option>
                    <option value="confirmed">{t("asset.filter.option.confirmed")}</option>
                  </select>
                </label>
                <label
                  htmlFor={assetSourceTypeFilterInputId}
                  style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
                >
                  <span>{t("asset.filter.sourceType")}</span>
                  <select
                    id={assetSourceTypeFilterInputId}
                    value={assetMonitor.filters.sourceType}
                    onChange={(event) => {
                      onAssetSourceTypeFilterChange?.(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "8px 10px",
                      font: "inherit",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">{t("asset.filter.option.all")}</option>
                    <option value="upload_session">upload_session</option>
                    <option value="workflow_import">workflow_import</option>
                    <option value="manual_upload">manual_upload</option>
                  </select>
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              {assetMonitor.importBatches.map((batch) => (
                <article
                  key={batch.id}
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.82)",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{batch.id}</strong>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        borderRadius: "999px",
                        padding: "8px 14px",
                        background: "#1d4ed8",
                        color: "#eff6ff",
                        cursor: "pointer",
                      }}
                      aria-label={t("asset.detail.button", { id: batch.id })}
                      onClick={() => {
                        onSelectImportBatch?.(batch.id);
                      }}
                    >
                      {t("asset.detail.open")}
                    </button>
                  </div>
                  <p style={metricStyle}>
                    {t("asset.batch.summary", {
                      sourceType: batch.sourceType,
                      status: batch.status,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("asset.batch.counts", {
                      uploadSessionCount: batch.uploadSessionCount,
                      itemCount: batch.itemCount,
                      confirmedItemCount: batch.confirmedItemCount,
                      candidateAssetCount: batch.candidateAssetCount,
                      mediaAssetCount: batch.mediaAssetCount,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("asset.batch.updatedAt", {
                      updatedAt: formatDateTime(batch.updatedAt),
                    })}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("governance.session.title")}
            </h2>
            <div style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
              <p style={metricStyle}>{t("governance.session.idLabel")}</p>
              <p style={metricStyle}>{governance.currentSession.sessionId}</p>
              <p style={metricStyle}>
                {t("governance.session.orgId", { orgId: governance.currentSession.orgId })}
              </p>
              <p style={metricStyle}>
                {t("governance.session.userId", { userId: governance.currentSession.userId })}
              </p>
              <p style={metricStyle}>
                {t("governance.session.locale", { locale: governance.currentSession.locale })}
              </p>
              <p style={metricStyle}>
                {t("governance.session.role", { roleCode: governance.currentSession.roleCode })}
              </p>
              <p style={metricStyle}>
                {t("governance.session.timezone", {
                  timezone: governance.currentSession.timezone || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("governance.session.permissions", {
                  permissions:
                    governance.currentSession.permissionCodes.join(", ") || "none",
                })}
              </p>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <label
                htmlFor={displayLocaleInputId}
                style={{ fontSize: "0.9rem", color: "#334155" }}
              >
                {t("governance.preferences.displayLocale")}
              </label>
              <input
                id={displayLocaleInputId}
                value={displayLocale}
                disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
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
                disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
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
                disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "10px 16px",
                  background:
                    !canManageUserPreferences || governanceActionPending ? "#94a3b8" : "#1d4ed8",
                  color: "#eff6ff",
                  cursor:
                    !canManageUserPreferences || governanceActionPending
                      ? "not-allowed"
                      : "pointer",
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
            {governanceActionFeedback ? (
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "12px",
                  fontSize: "0.9rem",
                  ...governanceFeedbackPalette,
                }}
              >
                {governanceActionFeedback.message}
              </p>
            ) : null}
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "10px" }}>
                <h3 style={{ margin: 0 }}>{t("governance.members.title")}</h3>
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
                        aria-label={t("governance.members.roleSelect", { userId: member.userId })}
                        value={draftRoleId}
                        disabled={!canManageMembers || Boolean(governanceActionPending)}
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
                        disabled={!canManageMembers || Boolean(governanceActionPending)}
                        style={{
                          border: 0,
                          borderRadius: "999px",
                          padding: "10px 16px",
                          background:
                            !canManageMembers || governanceActionPending ? "#94a3b8" : "#0f766e",
                          color: "#ecfeff",
                          cursor:
                            !canManageMembers || governanceActionPending
                              ? "not-allowed"
                              : "pointer",
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
                <h3 style={{ margin: 0 }}>{t("governance.locale.title")}</h3>
                <label htmlFor={orgLocaleInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
                  {t("governance.locale.defaultLocale")}
                </label>
                <input
                  id={orgLocaleInputId}
                  value={orgDefaultLocale}
                  disabled={!canManageOrgSettings || Boolean(governanceActionPending)}
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
                  disabled={!canManageOrgSettings || Boolean(governanceActionPending)}
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "10px 16px",
                    background:
                      !canManageOrgSettings || governanceActionPending ? "#94a3b8" : "#7c3aed",
                    color: "#f5f3ff",
                    cursor:
                      !canManageOrgSettings || governanceActionPending
                        ? "not-allowed"
                        : "pointer",
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

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
              {t("governance.roles.title")}
            </h2>
            <div style={{ display: "grid", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.82)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                }}
              >
                <h3 style={{ margin: 0 }}>{t("governance.roles.create.title")}</h3>
                <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
                  <span>{t("governance.roles.create.code")}</span>
                  <input
                    aria-label={t("governance.roles.create.code")}
                    value={newRoleCode}
                    disabled={!canManageRoles || Boolean(governanceActionPending)}
                    onChange={(event) => {
                      setNewRoleCode(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "10px 12px",
                      font: "inherit",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
                  <span>{t("governance.roles.create.displayName")}</span>
                  <input
                    aria-label={t("governance.roles.create.displayName")}
                    value={newRoleDisplayName}
                    disabled={!canManageRoles || Boolean(governanceActionPending)}
                    onChange={(event) => {
                      setNewRoleDisplayName(event.target.value);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "10px 12px",
                      font: "inherit",
                    }}
                  />
                </label>
                <div style={{ display: "grid", gap: "8px" }}>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {t("governance.roles.permissions.title")}
                  </strong>
                  {governance.availablePermissions.map((permission) => (
                    <label
                      key={`create-${permission.code}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#334155",
                        fontSize: "0.9rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newRolePermissionCodes.includes(permission.code)}
                        disabled={!canManageRoles || Boolean(governanceActionPending)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setNewRolePermissionCodes((current) =>
                            checked
                              ? [...new Set([...current, permission.code])]
                              : current.filter((code) => code !== permission.code),
                          );
                        }}
                      />
                      {permission.displayName} ({permission.code})
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={
                    !canManageRoles ||
                    Boolean(governanceActionPending) ||
                    newRoleCode.trim() === "" ||
                    newRoleDisplayName.trim() === ""
                  }
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "10px 16px",
                    background:
                      !canManageRoles ||
                      governanceActionPending ||
                      newRoleCode.trim() === "" ||
                      newRoleDisplayName.trim() === ""
                        ? "#94a3b8"
                        : "#0f766e",
                    color: "#ecfeff",
                    cursor:
                      !canManageRoles ||
                      governanceActionPending ||
                      newRoleCode.trim() === "" ||
                      newRoleDisplayName.trim() === ""
                        ? "not-allowed"
                        : "pointer",
                    justifySelf: "start",
                  }}
                  onClick={() => {
                    onCreateRole?.({
                      code: newRoleCode,
                      displayName: newRoleDisplayName,
                      permissionCodes: newRolePermissionCodes,
                    });
                  }}
                >
                  {t("governance.roles.create.submit")}
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {governance.roles.map((role) => {
                  const displayNameDraft =
                    roleDisplayNameDrafts[role.roleId] ?? role.displayName;
                  const permissionCodesDraft =
                    rolePermissionDrafts[role.roleId] ?? role.permissionCodes;
                  const deleteDisabled =
                    !canManageRoles || Boolean(governanceActionPending) || role.memberCount > 0;

                  return (
                    <article
                      key={role.roleId}
                      style={{
                        display: "grid",
                        gap: "12px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "#ffffff",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                      }}
                    >
                      <div style={{ display: "grid", gap: "6px" }}>
                        <strong>{role.code}</strong>
                        <p style={metricStyle}>
                          {t("governance.roles.memberCount", { count: role.memberCount })}
                        </p>
                      </div>
                      <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
                        <span>{t("governance.roles.edit.displayName")}</span>
                        <input
                          aria-label={t("governance.roles.edit.displayNameFor", { code: role.code })}
                          value={displayNameDraft}
                          disabled={!canManageRoles || Boolean(governanceActionPending)}
                          onChange={(event) => {
                            setRoleDisplayNameDrafts((current) => ({
                              ...current,
                              [role.roleId]: event.target.value,
                            }));
                          }}
                          style={{
                            borderRadius: "12px",
                            border: "1px solid rgba(148, 163, 184, 0.45)",
                            padding: "10px 12px",
                            font: "inherit",
                          }}
                        />
                      </label>
                      <div style={{ display: "grid", gap: "8px" }}>
                        <strong style={{ fontSize: "0.95rem" }}>
                          {t("governance.roles.permissions.title")}
                        </strong>
                        {governance.availablePermissions.map((permission) => (
                          <label
                            key={`${role.roleId}-${permission.code}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              color: "#334155",
                              fontSize: "0.9rem",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={permissionCodesDraft.includes(permission.code)}
                              disabled={!canManageRoles || Boolean(governanceActionPending)}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setRolePermissionDrafts((current) => {
                                  const nextCodes = current[role.roleId] ?? [...role.permissionCodes];
                                  return {
                                    ...current,
                                    [role.roleId]: checked
                                      ? [...new Set([...nextCodes, permission.code])]
                                      : nextCodes.filter((code) => code !== permission.code),
                                  };
                                });
                              }}
                            />
                            {permission.displayName} ({permission.code})
                          </label>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={!canManageRoles || Boolean(governanceActionPending)}
                          style={{
                            border: 0,
                            borderRadius: "999px",
                            padding: "10px 16px",
                            background:
                              !canManageRoles || governanceActionPending ? "#94a3b8" : "#1d4ed8",
                            color: "#eff6ff",
                            cursor:
                              !canManageRoles || governanceActionPending
                                ? "not-allowed"
                                : "pointer",
                          }}
                          onClick={() => {
                            onUpdateRole?.({
                              roleId: role.roleId,
                              displayName: displayNameDraft,
                              permissionCodes: permissionCodesDraft,
                            });
                          }}
                        >
                          {t("governance.roles.edit.submit")}
                        </button>
                        <button
                          type="button"
                          disabled={deleteDisabled}
                          style={{
                            border: 0,
                            borderRadius: "999px",
                            padding: "10px 16px",
                            background: deleteDisabled ? "#94a3b8" : "#991b1b",
                            color: "#fef2f2",
                            cursor: deleteDisabled ? "not-allowed" : "pointer",
                          }}
                          onClick={() => {
                            onDeleteRole?.({
                              roleId: role.roleId,
                            });
                          }}
                        >
                          {role.memberCount > 0
                            ? t("governance.roles.delete.inUse")
                            : t("governance.roles.delete.submit")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </article>
        </section>
      </section>
      {importBatchDetail && !assetProvenanceDetail ? (
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
            aria-labelledby={assetDetailTitleId}
            ref={assetDetailDialogRef}
            tabIndex={-1}
            style={{
              width: "min(900px, 100%)",
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
                <h2 id={assetDetailTitleId} style={{ margin: 0 }}>
                  {t("asset.detail.title")}
                </h2>
                <p style={metricStyle}>{importBatchDetail.batch.id}</p>
              </div>
              <button
                type="button"
                ref={assetDetailCloseButtonRef}
                aria-label={t("asset.detail.close")}
                onClick={() => {
                  onCloseImportBatchDetail?.();
                }}
                style={{
                  ...workflowActionButtonBaseStyle,
                  ...workflowActionButtonToneStyles.close,
                }}
              >
                {t("asset.detail.close")}
              </button>
            </div>
            {assetActionFeedback ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  ...assetFeedbackPalette,
                }}
              >
                {assetActionFeedback.message}
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
                {t("asset.detail.project", { projectId: importBatchDetail.batch.projectId })}
              </p>
              <p style={metricStyle}>
                {t("asset.detail.org", { orgId: importBatchDetail.batch.orgId })}
              </p>
              <p style={metricStyle}>
                {t("asset.detail.operator", { operatorId: importBatchDetail.batch.operatorId })}
              </p>
              <p style={metricStyle}>
                {t("asset.detail.sourceType", {
                  sourceType: importBatchDetail.batch.sourceType,
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.detail.status", { status: importBatchDetail.batch.status })}
              </p>
              <p style={metricStyle}>
                {t("asset.detail.section.summary", {
                  uploadSessionCount: importBatchDetail.uploadSessions.length,
                  itemCount: importBatchDetail.items.length,
                  candidateAssetCount: importBatchDetail.candidateAssets.length,
                  mediaAssetCount: importBatchDetail.mediaAssets.length,
                })}
              </p>
            </div>

            <section style={{ display: "grid", gap: "12px" }}>
              <h3 style={{ margin: 0 }}>{t("asset.detail.uploadSessions")}</h3>
              {importBatchDetail.uploadSessions.map((session) => (
                <article
                  key={session.id}
                  style={{
                    display: "grid",
                    gap: "6px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <strong>{session.fileName || session.id}</strong>
                  <p style={metricStyle}>
                    {t("asset.uploadSession.summary", {
                      status: session.status,
                      size: formatFileSize(session.sizeBytes),
                      retryCount: session.retryCount,
                    })}
                  </p>
                  <p style={metricStyle}>
                    {t("asset.uploadSession.checksum", { checksum: session.checksum || "none" })}
                  </p>
                </article>
              ))}
            </section>

            <section style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <h3 style={{ margin: 0 }}>{t("asset.detail.items")}</h3>
                  <p style={metricStyle}>
                    {t("asset.action.selection.summary", {
                      selectedCount: selectedActionableImportItemIds.length,
                      actionableCount: actionableImportItemIds.length,
                    })}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={Boolean(assetActionPending) || selectedActionableImportItemIds.length === 0}
                    onClick={() => {
                      onConfirmSelectedImportBatchItems?.({
                        importBatchId: importBatchDetail.batch.id,
                        itemIds: selectedActionableImportItemIds,
                      });
                    }}
                    style={{
                      ...workflowActionButtonBaseStyle,
                      ...(assetActionPending || selectedActionableImportItemIds.length === 0
                        ? workflowActionButtonToneStyles.pending
                        : workflowActionButtonToneStyles.confirm),
                    }}
                  >
                    {t("asset.action.confirmSelected.button")}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(assetActionPending) || actionableImportItemIds.length === 0}
                    onClick={() => {
                      onConfirmAllImportBatchItems?.({
                        importBatchId: importBatchDetail.batch.id,
                        itemIds: actionableImportItemIds,
                      });
                    }}
                    style={{
                      ...workflowActionButtonBaseStyle,
                      ...(assetActionPending || actionableImportItemIds.length === 0
                        ? workflowActionButtonToneStyles.pending
                        : workflowActionButtonToneStyles.confirm),
                    }}
                  >
                    {t("asset.action.confirmAll.button")}
                  </button>
                </div>
              </div>
              {importBatchDetail.items.map((item) => (
                <article
                  key={item.id}
                  style={{
                    display: "grid",
                    gap: "6px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <strong>{item.id}</strong>
                  <p style={metricStyle}>
                    {t("asset.item.summary", { status: item.status, assetId: item.assetId || "none" })}
                  </p>
                  {item.status !== "confirmed" && item.assetId ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#334155",
                          fontSize: "0.95rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={t("asset.action.selection.item", { itemId: item.id })}
                          checked={selectedImportItemIds.includes(item.id)}
                          disabled={Boolean(assetActionPending)}
                          onChange={(event) => {
                            onToggleImportBatchItemSelection?.({
                              itemId: item.id,
                              checked: event.currentTarget.checked,
                            });
                          }}
                        />
                        {t("asset.action.selection.label")}
                      </label>
                      <button
                        type="button"
                        disabled={Boolean(assetActionPending)}
                        aria-label={t("asset.action.confirm.buttonLabel", { itemId: item.id })}
                        onClick={() => {
                          onConfirmImportBatchItem?.({
                            importBatchId: importBatchDetail.batch.id,
                            itemId: item.id,
                          });
                        }}
                        style={{
                          ...workflowActionButtonBaseStyle,
                          ...(assetActionPending
                            ? workflowActionButtonToneStyles.pending
                            : workflowActionButtonToneStyles.confirm),
                        }}
                      >
                        {t("asset.action.confirm.button")}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>

            <section style={{ display: "grid", gap: "12px" }}>
              <h3 style={{ margin: 0 }}>{t("asset.detail.candidateAssets")}</h3>
              {importBatchDetail.candidateAssets.map((candidate) => (
                <article
                  key={candidate.id}
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <strong>{candidate.id}</strong>
                  <p style={metricStyle}>
                    {t("asset.candidate.summary", {
                      shotExecutionId: candidate.shotExecutionId || "none",
                      sourceRunId: candidate.sourceRunId || "none",
                    })}
                  </p>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={metricStyle}>
                      {t("asset.candidate.assetId", { assetId: candidate.assetId || "none" })}
                    </span>
                    {candidate.assetId ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("asset.provenance.button", { assetId: candidate.assetId })}
                          onClick={() => {
                            onSelectAssetProvenance?.(candidate.assetId);
                          }}
                          style={{
                            border: 0,
                            borderRadius: "999px",
                            padding: "8px 14px",
                            background: "#0f766e",
                            color: "#ecfeff",
                            cursor: "pointer",
                          }}
                        >
                          {t("asset.provenance.open")}
                        </button>
                        {candidate.shotExecutionId ? (
                          <button
                            type="button"
                            disabled={Boolean(assetActionPending)}
                            aria-label={t("asset.action.selectPrimary.buttonLabel", {
                              candidateId: candidate.id,
                            })}
                            onClick={() => {
                              onSelectPrimaryAsset?.({
                                shotExecutionId: candidate.shotExecutionId,
                                assetId: candidate.assetId,
                              });
                            }}
                            style={{
                              ...workflowActionButtonBaseStyle,
                              ...(assetActionPending
                                ? workflowActionButtonToneStyles.pending
                                : workflowActionButtonToneStyles.primary),
                            }}
                          >
                            {t("asset.action.selectPrimary.button")}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>

            <section style={{ display: "grid", gap: "12px" }}>
              <h3 style={{ margin: 0 }}>{t("asset.detail.mediaAssets")}</h3>
              {importBatchDetail.mediaAssets.map((asset) => (
                <article
                  key={asset.id}
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <strong>{asset.id}</strong>
                  <p style={metricStyle}>
                    {t("asset.media.summary", {
                      sourceType: asset.sourceType,
                      rightsStatus: asset.rightsStatus,
                      locale: asset.locale || "none",
                    })}
                  </p>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={metricStyle}>
                      {t("asset.media.importBatchId", {
                        importBatchId: asset.importBatchId || "none",
                      })}
                    </span>
                    <button
                      type="button"
                      aria-label={t("asset.provenance.button", { assetId: asset.id })}
                      onClick={() => {
                        onSelectAssetProvenance?.(asset.id);
                      }}
                      style={{
                        border: 0,
                        borderRadius: "999px",
                        padding: "8px 14px",
                        background: "#0f766e",
                        color: "#ecfeff",
                        cursor: "pointer",
                      }}
                    >
                      {t("asset.provenance.open")}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </aside>
        </div>
      ) : null}
      {assetProvenanceDetail ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={assetProvenanceTitleId}
            ref={assetProvenanceDialogRef}
            tabIndex={-1}
            style={{
              width: "min(720px, 100%)",
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
                <h2 id={assetProvenanceTitleId} style={{ margin: 0 }}>
                  {t("asset.provenance.title")}
                </h2>
                <p style={metricStyle}>{assetProvenanceDetail.asset.id}</p>
              </div>
              <button
                type="button"
                ref={assetProvenanceCloseButtonRef}
                aria-label={t("asset.provenance.close")}
                onClick={() => {
                  onCloseAssetProvenance?.();
                }}
                style={{
                  ...workflowActionButtonBaseStyle,
                  ...workflowActionButtonToneStyles.close,
                }}
              >
                {t("asset.provenance.close")}
              </button>
            </div>
            <p style={metricStyle}>{assetProvenanceDetail.provenanceSummary}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <p style={metricStyle}>
                {t("asset.provenance.candidateAssetId", {
                  candidateAssetId: assetProvenanceDetail.candidateAssetId || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.shotExecutionId", {
                  shotExecutionId: assetProvenanceDetail.shotExecutionId || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.sourceRunId", {
                  sourceRunId: assetProvenanceDetail.sourceRunId || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.importBatchId", {
                  importBatchId: assetProvenanceDetail.importBatchId || "none",
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.variantCount", {
                  variantCount: assetProvenanceDetail.variantCount,
                })}
              </p>
              <p style={metricStyle}>
                {t("asset.provenance.assetMeta", {
                  sourceType: assetProvenanceDetail.asset.sourceType,
                  rightsStatus: assetProvenanceDetail.asset.rightsStatus,
                  locale: assetProvenanceDetail.asset.locale || "none",
                })}
              </p>
            </div>
          </aside>
        </div>
      ) : null}
      {workflowRunDetail ? (
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
                        ...workflowActionButtonBaseStyle,
                        ...(workflowActionPending
                          ? workflowActionButtonToneStyles.pending
                          : workflowActionButtonToneStyles.retry),
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
                        ...workflowActionButtonBaseStyle,
                        ...(workflowActionPending
                          ? workflowActionButtonToneStyles.pending
                          : workflowActionButtonToneStyles.cancel),
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
                      ...workflowActionButtonBaseStyle,
                      ...workflowActionButtonToneStyles.close,
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
                  ...workflowFeedbackPalette,
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
      ) : null}
    </main>
  );
}
