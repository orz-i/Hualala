import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AdminGovernanceViewModel } from "./governance";
import { loadGovernancePanel } from "./loadGovernancePanel";
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

export function useAdminGovernanceController({
  sessionState,
  enabled,
  identityOverride,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  enabled: boolean;
  identityOverride: IdentityOverride;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [governance, setGovernance] = useState<AdminGovernanceViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [governanceActionFeedback, setGovernanceActionFeedback] =
    useState<ActionFeedback>(null);
  const [governanceActionPending, setGovernanceActionPending] = useState(false);

  const refreshGovernance = useCallback(async () => {
    if (!enabled || sessionState !== "ready") {
      return;
    }

    const nextGovernance = await loadGovernancePanel({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setGovernance(nextGovernance);
      setErrorMessage("");
    });
  }, [enabled, identityOverride?.orgId, identityOverride?.userId, sessionState]);

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
      if (!enabled || governanceActionPending) {
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
    [
      effectiveOrgId,
      effectiveUserId,
      enabled,
      governanceActionPending,
      refreshGovernance,
      t,
    ],
  );

  useEffect(() => {
    if (sessionState !== "ready" || !enabled) {
      startTransition(() => {
        setGovernance(null);
        setErrorMessage("");
        setGovernanceActionFeedback(null);
        setGovernanceActionPending(false);
      });
      return;
    }

    let cancelled = false;

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
          setErrorMessage("");
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
  }, [enabled, identityOverride?.orgId, identityOverride?.userId, sessionState]);

  return {
    governance,
    errorMessage,
    governanceActionFeedback,
    governanceActionPending,
    refreshGovernance,
    onUpdateUserPreferences: (input: {
      userId: string;
      displayLocale: string;
      timezone: string;
    }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.preferences.pending"),
        successMessage: t("governance.action.preferences.success"),
        execute: (options) =>
          updateUserPreferences({
            ...options,
            displayLocale: input.displayLocale,
            timezone: input.timezone,
          }),
      });
    },
    onUpdateMemberRole: (input: { memberId: string; roleId: string }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.members.pending"),
        successMessage: t("governance.action.members.success"),
        execute: (options) =>
          updateMemberRole({
            ...options,
            memberId: input.memberId,
            roleId: input.roleId,
          }),
      });
    },
    onUpdateOrgLocaleSettings: (input: { defaultLocale: string }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.locale.pending"),
        successMessage: t("governance.action.locale.success"),
        execute: (options) =>
          updateOrgLocaleSettings({
            ...options,
            defaultLocale: input.defaultLocale,
          }),
      });
    },
    onCreateRole: (input: {
      code: string;
      displayName: string;
      permissionCodes: string[];
    }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.roles.create.pending"),
        successMessage: t("governance.action.roles.create.success"),
        execute: (options) =>
          createRole({
            ...options,
            code: input.code,
            displayName: input.displayName,
            permissionCodes: input.permissionCodes,
          }),
      });
    },
    onUpdateRole: (input: {
      roleId: string;
      displayName: string;
      permissionCodes: string[];
    }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.roles.update.pending"),
        successMessage: t("governance.action.roles.update.success"),
        execute: (options) =>
          updateRole({
            ...options,
            roleId: input.roleId,
            displayName: input.displayName,
            permissionCodes: input.permissionCodes,
          }),
      });
    },
    onDeleteRole: (input: { roleId: string }) => {
      void runGovernanceAction({
        pendingMessage: t("governance.action.roles.delete.pending"),
        successMessage: t("governance.action.roles.delete.success"),
        execute: (options) =>
          deleteRole({
            ...options,
            roleId: input.roleId,
          }),
      });
    },
  };
}
