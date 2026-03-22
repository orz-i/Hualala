import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type {
  AdminOverviewViewModel,
  RecentChangeSummary,
} from "./AdminOverviewPage";
import type { AdminGovernanceViewModel } from "./governance";
import { loadAdminOverview } from "./loadAdminOverview";
import { loadGovernancePanel } from "./loadGovernancePanel";
import { updateBudgetPolicy } from "./mutateBudgetPolicy";
import {
  createRole,
  deleteRole,
  updateMemberRole,
  updateOrgLocaleSettings,
  updateRole,
  updateUserPreferences,
} from "./mutateGovernance";
import { waitForFeedbackPaint } from "./waitForFeedbackPaint";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

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

export function useAdminOverviewGovernance({
  sessionState,
  projectId,
  shotExecutionId,
  identityOverride,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  shotExecutionId: string;
  identityOverride: IdentityOverride;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [governance, setGovernance] = useState<AdminGovernanceViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<ActionFeedback>(null);
  const [governanceActionFeedback, setGovernanceActionFeedback] =
    useState<ActionFeedback>(null);
  const [governanceActionPending, setGovernanceActionPending] = useState(false);

  const refreshOverview = useCallback(async () => {
    const nextOverview = await loadAdminOverview({ projectId, shotExecutionId });
    startTransition(() => {
      setOverview(nextOverview);
      setErrorMessage("");
    });
  }, [projectId, shotExecutionId]);

  const refreshGovernance = useCallback(async () => {
    const nextGovernance = await loadGovernancePanel({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setGovernance(nextGovernance);
    });
  }, [identityOverride?.orgId, identityOverride?.userId]);

  const runGovernanceAction = useCallback(
    async ({
      pendingMessage,
      successMessage,
      execute,
    }: {
      pendingMessage: string;
      successMessage: string;
      execute: (input: { orgId: string; userId: string }) => Promise<unknown>;
    }) => {
      if (governanceActionPending) {
        return;
      }

      startTransition(() => {
        setGovernanceActionPending(true);
        setGovernanceActionFeedback({
          tone: "pending",
          message: pendingMessage,
        });
      });

      try {
        await waitForFeedbackPaint();
        await execute({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
        });
        await refreshGovernance();
        startTransition(() => {
          setGovernanceActionPending(false);
          setGovernanceActionFeedback({
            tone: "success",
            message: successMessage,
          });
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown governance action error";
        startTransition(() => {
          setGovernanceActionPending(false);
          setGovernanceActionFeedback({
            tone: "error",
            message: t("governance.action.error", { message }),
          });
        });
      }
    },
    [effectiveOrgId, effectiveUserId, governanceActionPending, refreshGovernance, t],
  );

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setOverview(null);
        setGovernance(null);
        setErrorMessage("");
        setBudgetFeedback(null);
        setGovernanceActionFeedback(null);
        setGovernanceActionPending(false);
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

    loadGovernancePanel({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextGovernance) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setGovernance(nextGovernance);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown governance error";
        startTransition(() => {
          setErrorMessage(message);
          setGovernance(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
    sessionState,
    shotExecutionId,
  ]);

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
    governance,
    errorMessage,
    budgetFeedback,
    governanceActionFeedback,
    governanceActionPending,
    refreshOverview,
    refreshGovernance,
    applyRecentChange,
    onUpdateBudgetLimit,
    onUpdateUserPreferences: (input: {
      userId: string;
      displayLocale: string;
      timezone: string;
    }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.preferences.pending"),
        successMessage: t("governance.action.preferences.success"),
        execute: (options) =>
          updateUserPreferences({
            ...options,
            displayLocale: input.displayLocale,
            timezone: input.timezone,
          }),
      }),
    onUpdateMemberRole: (input: { memberId: string; roleId: string }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.members.pending"),
        successMessage: t("governance.action.members.success"),
        execute: (options) =>
          updateMemberRole({
            ...options,
            memberId: input.memberId,
            roleId: input.roleId,
          }),
      }),
    onUpdateOrgLocaleSettings: (input: { defaultLocale: string }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.locale.pending"),
        successMessage: t("governance.action.locale.success"),
        execute: (options) =>
          updateOrgLocaleSettings({
            ...options,
            defaultLocale: input.defaultLocale,
          }),
      }),
    onCreateRole: (input: {
      code: string;
      displayName: string;
      permissionCodes: string[];
    }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.roles.create.pending"),
        successMessage: t("governance.action.roles.create.success"),
        execute: (options) =>
          createRole({
            ...options,
            code: input.code,
            displayName: input.displayName,
            permissionCodes: input.permissionCodes,
          }),
      }),
    onUpdateRole: (input: {
      roleId: string;
      displayName: string;
      permissionCodes: string[];
    }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.roles.update.pending"),
        successMessage: t("governance.action.roles.update.success"),
        execute: (options) =>
          updateRole({
            ...options,
            roleId: input.roleId,
            displayName: input.displayName,
            permissionCodes: input.permissionCodes,
          }),
      }),
    onDeleteRole: (input: { roleId: string }) =>
      runGovernanceAction({
        pendingMessage: t("governance.action.roles.delete.pending"),
        successMessage: t("governance.action.roles.delete.success"),
        execute: (options) =>
          deleteRole({
            ...options,
            roleId: input.roleId,
          }),
      }),
  };
}
