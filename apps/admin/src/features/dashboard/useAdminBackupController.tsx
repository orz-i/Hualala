import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AdminBackupViewModel, BackupPreflightViewModel } from "./backup";
import { downloadBackupPackageFile } from "./downloadBackupPackageFile";
import { loadBackupPanel } from "./loadBackupPanel";
import {
  applyBackupPackage,
  createBackupPackage,
  getBackupPackage,
  preflightRestoreBackupPackage,
} from "./mutateBackup";
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

export function useAdminBackupController({
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
  const [backup, setBackup] = useState<AdminBackupViewModel | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [restorePreflight, setRestorePreflight] = useState<BackupPreflightViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [backupActionFeedback, setBackupActionFeedback] = useState<ActionFeedback>(null);
  const [backupActionPending, setBackupActionPending] = useState(false);

  const syncSelection = useCallback(
    (nextBackup: AdminBackupViewModel, preferredPackageId?: string) => {
      const nextSelectedPackageId =
        preferredPackageId &&
        nextBackup.backupPackages.some((item) => item.packageId === preferredPackageId)
          ? preferredPackageId
          : nextBackup.backupPackages.find((item) => item.packageId === selectedPackageId)?.packageId ??
            nextBackup.backupPackages[0]?.packageId ??
            "";
      setSelectedPackageId(nextSelectedPackageId);
      setRestorePreflight((previous) =>
        previous && previous.packageId === nextSelectedPackageId ? previous : null,
      );
    },
    [selectedPackageId],
  );

  const refreshBackup = useCallback(
    async (preferredPackageId?: string) => {
      if (!enabled || sessionState !== "ready") {
        return;
      }

      const nextBackup = await loadBackupPanel({
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setBackup(nextBackup);
        setErrorMessage("");
        syncSelection(nextBackup, preferredPackageId);
      });
    },
    [enabled, identityOverride?.orgId, identityOverride?.userId, sessionState, syncSelection],
  );

  const runBackupAction = useCallback(
    async ({
      pendingMessage,
      successMessage,
      execute,
    }: {
      pendingMessage: string;
      successMessage: string;
      execute: (input: { orgId: string; userId: string }) => Promise<void>;
    }) => {
      if (
        !enabled ||
        backupActionPending ||
        !backup?.capabilities.canManageBackup ||
        !backup.capabilities.isRuntimeAvailable
      ) {
        return;
      }

      startTransition(() => {
        setBackupActionPending(true);
        setBackupActionFeedback({
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
        startTransition(() => {
          setBackupActionPending(false);
          setBackupActionFeedback({
            tone: "success",
            message: successMessage,
          });
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "admin: unknown backup action error";
        startTransition(() => {
          setBackupActionPending(false);
          setBackupActionFeedback({
            tone: "error",
            message: t("backup.action.error", { message }),
          });
        });
      }
    },
    [
      backup?.capabilities.canManageBackup,
      backup?.capabilities.isRuntimeAvailable,
      backupActionPending,
      effectiveOrgId,
      effectiveUserId,
      enabled,
      t,
    ],
  );

  useEffect(() => {
    if (sessionState !== "ready" || !enabled) {
      startTransition(() => {
        setBackup(null);
        setSelectedPackageId("");
        setRestorePreflight(null);
        setErrorMessage("");
        setBackupActionFeedback(null);
        setBackupActionPending(false);
      });
      return;
    }

    let cancelled = false;

    loadBackupPanel({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextBackup) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setBackup(nextBackup);
          setErrorMessage("");
          syncSelection(nextBackup);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "admin: unknown backup load error";
        startTransition(() => {
          setBackup(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, identityOverride?.orgId, identityOverride?.userId, sessionState, syncSelection]);

  return {
    backup,
    selectedPackageId,
    restorePreflight,
    errorMessage,
    backupActionFeedback,
    backupActionPending,
    refreshBackup,
    onSelectBackupPackage: (packageId: string) => {
      startTransition(() => {
        setSelectedPackageId(packageId);
        setRestorePreflight((previous) =>
          previous?.packageId === packageId ? previous : null,
        );
      });
    },
    onCreateBackupPackage: () => {
      void runBackupAction({
        pendingMessage: t("backup.action.create.pending"),
        successMessage: t("backup.action.create.success"),
        execute: async (options) => {
          const created = await createBackupPackage(options);
          await refreshBackup(created.packageId);
        },
      });
    },
    onDownloadBackupPackage: () => {
      if (!selectedPackageId) {
        return;
      }
      void runBackupAction({
        pendingMessage: t("backup.action.download.pending"),
        successMessage: t("backup.action.download.success"),
        execute: async (options) => {
          const payload = await getBackupPackage({
            ...options,
            packageId: selectedPackageId,
          });
          downloadBackupPackageFile(
            `hualala-backup-${selectedPackageId}.json`,
            payload.packageJson,
          );
        },
      });
    },
    onPreflightRestoreBackupPackage: () => {
      if (!selectedPackageId) {
        return;
      }
      void runBackupAction({
        pendingMessage: t("backup.action.preflight.pending"),
        successMessage: t("backup.action.preflight.success"),
        execute: async (options) => {
          const result = await preflightRestoreBackupPackage({
            ...options,
            packageId: selectedPackageId,
          });
          startTransition(() => {
            setRestorePreflight(result);
          });
        },
      });
    },
    onApplyBackupPackage: () => {
      if (!selectedPackageId) {
        return;
      }
      if (!restorePreflight || restorePreflight.packageId !== selectedPackageId) {
        startTransition(() => {
          setBackupActionFeedback({
            tone: "error",
            message: t("backup.apply.requiresPreflight"),
          });
        });
        return;
      }
      if (!globalThis.window?.confirm(t("backup.apply.confirm"))) {
        return;
      }
      void runBackupAction({
        pendingMessage: t("backup.action.apply.pending"),
        successMessage: t("backup.action.apply.success"),
        execute: async (options) => {
          await applyBackupPackage({
            ...options,
            packageId: selectedPackageId,
          });
          await refreshBackup(selectedPackageId);
          startTransition(() => {
            setRestorePreflight(null);
          });
        },
      });
    },
  };
}
