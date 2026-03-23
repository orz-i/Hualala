import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type {
  AdminOverviewViewModel,
  RecentChangeSummary,
} from "./overview";
import { loadAdminOverview } from "./loadAdminOverview";
import { updateBudgetPolicy } from "./mutateBudgetPolicy";
import { waitForFeedbackPaint } from "./waitForFeedbackPaint";

type ActionFeedback = {
  tone: "pending" | "success" | "error";
  message: string;
} | null;

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

export function useAdminOverviewController({
  sessionState,
  projectId,
  shotExecutionId,
  effectiveOrgId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  shotExecutionId: string;
  effectiveOrgId: string;
  t: AdminTranslator;
}) {
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<ActionFeedback>(null);

  const refreshOverview = useCallback(async () => {
    const nextOverview = await loadAdminOverview({ projectId, shotExecutionId });
    startTransition(() => {
      setOverview(nextOverview);
      setErrorMessage("");
    });
  }, [projectId, shotExecutionId]);

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setOverview(null);
        setErrorMessage("");
        setBudgetFeedback(null);
      });
      return;
    }

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
        const message = error instanceof Error ? error.message : "admin: unknown overview error";
        startTransition(() => {
          setErrorMessage(message);
          setOverview(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, sessionState, shotExecutionId]);

  const onUpdateBudgetLimit = useCallback(
    async (input: { projectId: string; limitCents: number }) => {
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
    },
    [effectiveOrgId, refreshOverview, t],
  );

  const applyRecentChange = useCallback((change: RecentChangeSummary) => {
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
  }, []);

  return {
    overview,
    errorMessage,
    budgetFeedback,
    refreshOverview,
    applyRecentChange,
    onUpdateBudgetLimit,
  };
}
