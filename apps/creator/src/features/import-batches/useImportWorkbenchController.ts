import { startTransition, useCallback, useEffect, useState } from "react";
import type { CreatorMessageKey, CreatorTranslator, LocaleCode } from "../../i18n";
import { subscribeWorkbenchEvents } from "../subscribeWorkbenchEvents";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { buildImportFeedback } from "../shared/buildActionFeedback";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { useQueuedSilentRefresh } from "../shared/useQueuedSilentRefresh";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import type {
  ImportBatchWorkbenchViewModel,
  SelectedUploadFileViewModel,
} from "./ImportBatchWorkbenchPage";
import { loadImportBatchWorkbench } from "./loadImportBatchWorkbench";
import {
  completeUploadSessionForImportBatch,
  confirmImportBatchItems,
  createUploadSessionForImportBatch,
  deriveUploadFileMetadata,
  retryUploadSessionForImportBatch,
  selectPrimaryAssetForImportBatch,
} from "./mutateImportBatchWorkbench";

type SelectedUploadFileState = SelectedUploadFileViewModel & {
  file: File;
};

type UseImportWorkbenchControllerOptions = {
  enabled: boolean;
  importBatchId: string | null;
  locale: LocaleCode;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
};

function buildLatestImportFeedback({
  t,
  messageKey,
  nextWorkbench,
}: {
  t: CreatorTranslator;
  messageKey: CreatorMessageKey;
  nextWorkbench: ImportBatchWorkbenchViewModel | undefined;
}) {
  return buildImportFeedback({
    t,
    tone: "success",
    messageKey,
    latestImportBatchStatus: nextWorkbench?.importBatch.status,
    latestUploadSessionStatus: nextWorkbench?.uploadSessions.at(-1)?.status ?? "pending",
    latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
    latestPrimaryAssetId: nextWorkbench?.shotExecutions[0]?.primaryAssetId,
  });
}

export function useImportWorkbenchController({
  enabled,
  importBatchId,
  locale,
  t,
  orgId,
  userId,
}: UseImportWorkbenchControllerOptions) {
  const [importWorkbench, setImportWorkbench] =
    useState<ImportBatchWorkbenchViewModel | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] =
    useState<SelectedUploadFileState | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const {
    selectedAssetId,
    assetProvenanceDetail,
    assetProvenanceStatus,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
    resetAssetProvenance,
  } = useAssetProvenanceState({
    t,
    orgId,
    userId,
  });

  const refreshImportWorkbench = useCallback(async () => {
    if (!importBatchId) {
      return null;
    }

    const nextWorkbench = await loadImportBatchWorkbench({
      importBatchId,
      orgId,
      userId,
    });
    startTransition(() => {
      setImportWorkbench(nextWorkbench);
      setErrorMessage("");
    });
    return nextWorkbench;
  }, [importBatchId, orgId, userId]);

  const scheduleSilentRefresh = useQueuedSilentRefresh("import", refreshImportWorkbench);

  useEffect(() => {
    if (!enabled || !importBatchId) {
      resetAssetProvenance();
      startTransition(() => {
        setImportWorkbench(null);
        setSelectedUploadFile(null);
        setFeedback(null);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();

    loadImportBatchWorkbench({
      importBatchId,
      orgId,
      userId,
    })
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setImportWorkbench(nextWorkbench);
          setSelectedUploadFile(null);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "creator: unknown import workbench error";
        startTransition(() => {
          setImportWorkbench(null);
          setSelectedUploadFile(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, importBatchId, orgId, resetAssetProvenance, userId]);

  useEffect(() => {
    if (
      !enabled ||
      !importWorkbench?.importBatch.orgId ||
      !importWorkbench.importBatch.projectId
    ) {
      return;
    }

    return subscribeWorkbenchEvents({
      organizationId: importWorkbench.importBatch.orgId,
      projectId: importWorkbench.importBatch.projectId,
      workbenchKind: "import",
      onRefreshNeeded: scheduleSilentRefresh,
      onError: (error) => {
        console.warn("creator: import sse subscription failed", error);
      },
    });
  }, [
    enabled,
    importWorkbench?.importBatch.id,
    importWorkbench?.importBatch.orgId,
    importWorkbench?.importBatch.projectId,
    scheduleSilentRefresh,
  ]);

  const runImportAction = useCallback(
    async <T,>({
      pendingMessageKey,
      errorMessageKey,
      action,
      onSuccess,
      successFeedback,
    }: {
      pendingMessageKey: CreatorMessageKey;
      errorMessageKey: CreatorMessageKey;
      action: () => Promise<T>;
      onSuccess?: (result: T) => void;
      successFeedback?: (result: T) => ActionFeedbackModel | null;
    }) => {
      startTransition(() => {
        setFeedback({
          tone: "pending",
          message: t(pendingMessageKey),
        });
      });

      try {
        await waitForFeedbackPaint();
        const result = await action();
        startTransition(() => {
          onSuccess?.(result);
          setFeedback(successFeedback ? successFeedback(result) : null);
        });
        return result;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "creator: unknown import workbench error";
        startTransition(() => {
          setFeedback({
            tone: "error",
            message: t(errorMessageKey, { message }),
          });
        });
        return null;
      }
    },
    [t],
  );

  const handleChooseUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        startTransition(() => {
          setSelectedUploadFile(null);
          setFeedback(null);
        });
        return;
      }

      await runImportAction({
        pendingMessageKey: "feedback.pending.readUploadFile",
        errorMessageKey: "feedback.error.readUploadFile",
        action: () => deriveUploadFileMetadata(file),
        onSuccess: (derived) => {
          setSelectedUploadFile(derived);
        },
      });
    },
    [runImportAction],
  );

  const handleRegisterSelectedUpload = useCallback(async () => {
    if (!importWorkbench || !selectedUploadFile) {
      return;
    }

    await runImportAction({
      pendingMessageKey: "feedback.pending.registerUpload",
      errorMessageKey: "feedback.error.registerUpload",
      action: async () => {
        const session = await createUploadSessionForImportBatch({
          organizationId: importWorkbench.importBatch.orgId,
          projectId: importWorkbench.importBatch.projectId,
          importBatchId: importWorkbench.importBatch.id,
          fileName: selectedUploadFile.fileName,
          checksum: selectedUploadFile.checksum,
          sizeBytes: selectedUploadFile.sizeBytes,
          orgId,
          userId,
        });
        await completeUploadSessionForImportBatch({
          sessionId: session.session_id,
          shotExecutionId: importWorkbench.shotExecutions[0]?.id ?? "",
          mimeType: selectedUploadFile.mimeType,
          locale,
          width: selectedUploadFile.width,
          height: selectedUploadFile.height,
          orgId,
          userId,
        });
        return refreshImportWorkbench();
      },
      onSuccess: () => {
        setSelectedUploadFile(null);
      },
      successFeedback: (nextWorkbench) =>
        buildLatestImportFeedback({
          t,
          messageKey: "feedback.success.registerUpload",
          nextWorkbench: nextWorkbench ?? undefined,
        }),
    });
  }, [
    importWorkbench,
    locale,
    orgId,
    refreshImportWorkbench,
    runImportAction,
    selectedUploadFile,
    t,
    userId,
  ]);

  const handleRetryUploadSession = useCallback(
    async (sessionId: string) => {
      await runImportAction({
        pendingMessageKey: "feedback.pending.retryUpload",
        errorMessageKey: "feedback.error.retryUpload",
        action: async () => {
          await retryUploadSessionForImportBatch({
            sessionId,
            orgId,
            userId,
          });
          return refreshImportWorkbench();
        },
        successFeedback: (nextWorkbench) =>
          buildLatestImportFeedback({
            t,
            messageKey: "feedback.success.retryUpload",
            nextWorkbench: nextWorkbench ?? undefined,
          }),
      });
    },
    [orgId, refreshImportWorkbench, runImportAction, t, userId],
  );

  const handleConfirmMatches = useCallback(
    async (input: { importBatchId: string; itemIds: string[] }) => {
      await runImportAction({
        pendingMessageKey: "feedback.pending.confirmMatches",
        errorMessageKey: "feedback.error.confirmMatches",
        action: async () => {
          await confirmImportBatchItems({
            ...input,
            orgId,
            userId,
          });
          return refreshImportWorkbench();
        },
        successFeedback: (nextWorkbench) =>
          buildLatestImportFeedback({
            t,
            messageKey: "feedback.success.confirmMatches",
            nextWorkbench: nextWorkbench ?? undefined,
          }),
      });
    },
    [orgId, refreshImportWorkbench, runImportAction, t, userId],
  );

  const handleSelectPrimaryAsset = useCallback(
    async (input: { shotExecutionId: string; assetId: string }) => {
      await runImportAction({
        pendingMessageKey: "feedback.pending.selectPrimary",
        errorMessageKey: "feedback.error.selectPrimary",
        action: async () => {
          await selectPrimaryAssetForImportBatch({
            ...input,
            orgId,
            userId,
          });
          return refreshImportWorkbench();
        },
        successFeedback: (nextWorkbench) =>
          buildLatestImportFeedback({
            t,
            messageKey: "feedback.success.selectPrimary",
            nextWorkbench: nextWorkbench ?? undefined,
          }),
      });
    },
    [orgId, refreshImportWorkbench, runImportAction, t, userId],
  );

  return {
    importWorkbench,
    selectedUploadFile,
    feedback,
    errorMessage,
    selectedAssetId,
    assetProvenanceDetail,
    assetProvenanceStatus,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleChooseUploadFile,
    handleRegisterSelectedUpload,
    handleRetryUploadSession,
    handleConfirmMatches,
    handleSelectPrimaryAsset,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
