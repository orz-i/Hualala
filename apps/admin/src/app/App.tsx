import { startTransition, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import {
  AdminOverviewPage,
  type AdminOverviewViewModel,
} from "../features/dashboard/AdminOverviewPage";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("projectId") ?? "project-demo-001";
  const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";
  const orgId = searchParams.get("orgId") ?? "org-demo-001";

  const refreshOverview = async () => {
    const nextOverview = await loadAdminOverview({ projectId, shotExecutionId });
    startTransition(() => {
      setOverview(nextOverview);
      setErrorMessage("");
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

    return () => {
      cancelled = true;
    };
  }, [projectId, shotExecutionId]);

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>{t("app.error.load", { message: errorMessage })}</main>;
  }

  if (!overview) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  return (
    <AdminOverviewPage
      overview={overview}
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
            orgId,
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
    />
  );
}
