import { startTransition, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import {
  AdminOverviewPage,
  type AdminOverviewViewModel,
} from "../features/dashboard/AdminOverviewPage";
import type { AdminGovernanceViewModel } from "../features/dashboard/governance";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { loadGovernancePanel } from "../features/dashboard/loadGovernancePanel";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import {
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "../features/dashboard/mutateGovernance";
import { subscribeAdminRecentChanges } from "../features/dashboard/subscribeRecentChanges";
import type { RecentChangeSummary } from "../features/dashboard/AdminOverviewPage";

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function buildFallbackGovernance(orgId?: string, userId?: string): AdminGovernanceViewModel {
  const fallbackOrgId = orgId ?? "org-dev-fallback";
  const fallbackUserId = userId ?? "user-dev-fallback";
  const locale = "zh-CN";

  return {
    currentSession: {
      sessionId: `dev:${fallbackOrgId}:${fallbackUserId}`,
      orgId: fallbackOrgId,
      userId: fallbackUserId,
      locale,
    },
    userPreferences: {
      userId: fallbackUserId,
      displayLocale: locale,
      timezone: "",
    },
    members: [],
    roles: [],
    orgLocaleSettings: {
      orgId: fallbackOrgId,
      defaultLocale: locale,
      supportedLocales: [locale],
    },
  };
}

function mergeRecentChanges(
  current: RecentChangeSummary[],
  nextChange: RecentChangeSummary,
): RecentChangeSummary[] {
  const order: Array<RecentChangeSummary["kind"]> = ["billing", "evaluation", "review"];
  const fallbackIndex = order.indexOf(nextChange.kind);
  const currentIndex = current.findIndex((change) => change.kind === nextChange.kind);
  const targetIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const next = [...current];

  if (targetIndex >= 0 && targetIndex < next.length) {
    next[targetIndex] = nextChange;
    return next;
  }

  next.push(nextChange);
  return next;
}

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [governance, setGovernance] = useState<AdminGovernanceViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("projectId") ?? "project-demo-001";
  const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";
  const orgId = searchParams.get("orgId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const subscriptionOrgId = orgId ?? governance?.currentSession.orgId;

  const refreshOverview = async () => {
    const nextOverview = await loadAdminOverview({ projectId, shotExecutionId });
    startTransition(() => {
      setOverview(nextOverview);
      setErrorMessage("");
    });
  };

  const refreshGovernance = async () => {
    const nextGovernance = await loadGovernancePanel({ orgId, userId });
    startTransition(() => {
      setGovernance(nextGovernance);
    });
  };

  useEffect(() => {
    let cancelled = false;
    loadAdminOverview({ projectId, shotExecutionId })
      .then((nextOverview) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setOverview(nextOverview);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown overview error";
        startTransition(() => {
          setErrorMessage(message);
          setOverview(null);
        });
      });

    loadGovernancePanel({ orgId, userId })
      .then((nextGovernance) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setGovernance(nextGovernance);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setGovernance(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, projectId, shotExecutionId, userId]);

  useEffect(() => {
    if (!overview || !subscriptionOrgId) {
      return;
    }

    return subscribeAdminRecentChanges({
      organizationId: subscriptionOrgId,
      projectId,
      onChange: (change) => {
        startTransition(() => {
          setOverview((current) => {
            if (!current) {
              return current;
            }
            return {
              ...current,
              recentChanges: mergeRecentChanges(current.recentChanges, change),
            };
          });
        });
      },
    });
  }, [overview ? "ready" : "idle", projectId, subscriptionOrgId]);

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>{t("app.error.load", { message: errorMessage })}</main>;
  }

  if (!overview) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  const effectiveGovernance = governance ?? buildFallbackGovernance(orgId, userId);
  const effectiveOrgId = orgId ?? effectiveGovernance.currentSession.orgId;
  const effectiveUserId = userId ?? effectiveGovernance.currentSession.userId;

  return (
    <AdminOverviewPage
      overview={overview}
      governance={effectiveGovernance}
      locale={locale}
      t={t}
      onLocaleChange={setLocale}
      budgetFeedback={budgetFeedback ?? undefined}
      onUpdateBudgetLimit={async (input) => {
        startTransition(() => {
          setBudgetFeedback({
            tone: "pending",
            message: t("budget.feedback.pending"),
          });
        });
        try {
          await waitForFeedbackPaint();
          await updateBudgetPolicy({
            orgId: effectiveOrgId,
            projectId: input.projectId,
            limitCents: input.limitCents,
          });
          await refreshOverview();
          startTransition(() => {
            setBudgetFeedback({
              tone: "success",
              message: t("budget.feedback.success"),
            });
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "admin: unknown budget update error";
          startTransition(() => {
            setBudgetFeedback({
              tone: "error",
              message: t("budget.feedback.error", { message }),
            });
          });
        }
      }}
      onUpdateUserPreferences={async (input) => {
        await updateUserPreferences({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          displayLocale: input.displayLocale,
          timezone: input.timezone,
        });
        await refreshGovernance();
      }}
      onUpdateMemberRole={async (input) => {
        await updateMemberRole({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          memberId: input.memberId,
          roleId: input.roleId,
        });
        await refreshGovernance();
      }}
      onUpdateOrgLocaleSettings={async (input) => {
        await updateOrgLocaleSettings({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          defaultLocale: input.defaultLocale,
        });
        await refreshGovernance();
      }}
    />
  );
}
