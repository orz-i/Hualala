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

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
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

  const refreshData = async () => {
    const [nextOverview, nextGovernance] = await Promise.all([
      loadAdminOverview({ projectId, shotExecutionId }),
      loadGovernancePanel({ orgId, userId }),
    ]);
    startTransition(() => {
      setOverview(nextOverview);
      setGovernance(nextGovernance);
      setErrorMessage("");
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAdminOverview({ projectId, shotExecutionId }),
      loadGovernancePanel({ orgId, userId }),
    ])
      .then(([nextOverview, nextGovernance]) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setOverview(nextOverview);
          setGovernance(nextGovernance);
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
          setGovernance(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, projectId, shotExecutionId, userId]);

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>{t("app.error.load", { message: errorMessage })}</main>;
  }

  if (!overview || !governance) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  const effectiveOrgId = orgId ?? governance.currentSession.orgId;
  const effectiveUserId = userId ?? governance.currentSession.userId;

  return (
    <AdminOverviewPage
      overview={overview}
      governance={governance}
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
          await refreshData();
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
        await refreshData();
      }}
      onUpdateMemberRole={async (input) => {
        await updateMemberRole({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          memberId: input.memberId,
          roleId: input.roleId,
        });
        await refreshData();
      }}
      onUpdateOrgLocaleSettings={async (input) => {
        await updateOrgLocaleSettings({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          defaultLocale: input.defaultLocale,
        });
        await refreshData();
      }}
    />
  );
}
