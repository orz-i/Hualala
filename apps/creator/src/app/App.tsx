import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { type CreatorMessageKey, useLocaleState } from "../i18n";
import {
  ImportBatchWorkbenchPage,
  type ImportBatchWorkbenchViewModel,
  type SelectedUploadFileViewModel,
} from "../features/import-batches/ImportBatchWorkbenchPage";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
  completeUploadSessionForImportBatch,
  createUploadSessionForImportBatch,
  deriveUploadFileMetadata,
  retryUploadSessionForImportBatch,
  selectPrimaryAssetForImportBatch,
} from "../features/import-batches/mutateImportBatchWorkbench";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import { loadShotWorkflowPanel } from "../features/shot-workbench/loadShotWorkflowPanel";
import {
  runSubmissionGateChecks,
  submitShotForReview,
} from "../features/shot-workbench/mutateShotWorkbench";
import {
  retryShotWorkflowRun,
  startShotWorkflow,
} from "../features/shot-workbench/mutateShotWorkflow";
import type { ActionFeedbackModel } from "../features/shared/ActionFeedback";
import {
  buildImportFeedback,
  buildShotFeedback,
} from "../features/shared/buildActionFeedback";
import { subscribeWorkbenchEvents } from "../features/subscribeWorkbenchEvents";
import {
  ShotWorkbenchPage,
  type ShotWorkbenchViewModel,
  type ShotWorkflowPanelViewModel,
} from "../features/shot-workbench/ShotWorkbenchPage";

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

type SelectedUploadFileState = SelectedUploadFileViewModel & {
  file: File;
};

function getRequestContext() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    importBatchId: searchParams.get("importBatchId"),
    shotId: searchParams.get("shotId") ?? "shot-demo-001",
    orgId: searchParams.get("orgId") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
  };
}

function buildLatestImportFeedback({
  t,
  messageKey,
  nextWorkbench,
}: {
  t: ReturnType<typeof useLocaleState>["t"];
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

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [shotWorkflowPanel, setShotWorkflowPanel] = useState<ShotWorkflowPanelViewModel | null>(
    null,
  );
  const [importWorkbench, setImportWorkbench] = useState<ImportBatchWorkbenchViewModel | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<SelectedUploadFileState | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [shotActionFeedback, setShotActionFeedback] = useState<ActionFeedbackModel | null>(null);
  const [importActionFeedback, setImportActionFeedback] = useState<ActionFeedbackModel | null>(
    null,
  );
  const shotRefreshStateRef = useRef({ inFlight: false, queued: false });
  const importRefreshStateRef = useRef({ inFlight: false, queued: false });

  useEffect(() => {
    let cancelled = false;
    const loadCurrentWorkbench = () => {
      const { importBatchId, shotId, orgId, userId } = getRequestContext();
      return {
        importBatchId,
        load: importBatchId
          ? loadImportBatchWorkbench({ importBatchId, orgId, userId })
          : (async () => {
              const nextShotWorkbench = await loadShotWorkbench({ shotId, orgId, userId });
              const nextWorkflowPanel = await loadShotWorkflowPanel({
                shotExecutionId: nextShotWorkbench.shotExecution.id,
                projectId: nextShotWorkbench.shotExecution.projectId,
                orgId,
                userId,
              });
              return {
                shotWorkbench: nextShotWorkbench,
                shotWorkflowPanel: nextWorkflowPanel,
              };
            })(),
      };
    };

    const { importBatchId, load } = loadCurrentWorkbench();

    load
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          if (importBatchId) {
            setImportWorkbench(nextWorkbench as ImportBatchWorkbenchViewModel);
            setShotWorkbench(null);
            setShotWorkflowPanel(null);
          } else {
            setShotWorkbench(
              (nextWorkbench as { shotWorkbench: ShotWorkbenchViewModel }).shotWorkbench,
            );
            setShotWorkflowPanel(
              (nextWorkbench as { shotWorkflowPanel: ShotWorkflowPanelViewModel })
                .shotWorkflowPanel,
            );
            setImportWorkbench(null);
          }
          setSelectedUploadFile(null);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "creator: unknown workbench error";
        startTransition(() => {
          setErrorMessage(message);
          setShotWorkbench(null);
          setShotWorkflowPanel(null);
          setImportWorkbench(null);
          setSelectedUploadFile(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshImportWorkbench = useCallback(async () => {
    const { importBatchId, orgId, userId } = getRequestContext();
    if (!importBatchId) {
      return;
    }
    const nextWorkbench = await loadImportBatchWorkbench({ importBatchId, orgId, userId });
    startTransition(() => {
      setImportWorkbench(nextWorkbench);
      setErrorMessage("");
    });
    return nextWorkbench;
  }, []);

  const refreshShotWorkbench = useCallback(async () => {
    const { shotId, orgId, userId } = getRequestContext();
    const nextWorkbench = await loadShotWorkbench({ shotId, orgId, userId });
    const nextWorkflowPanel = await loadShotWorkflowPanel({
      shotExecutionId: nextWorkbench.shotExecution.id,
      projectId: nextWorkbench.shotExecution.projectId,
      orgId,
      userId,
    });
    startTransition(() => {
      setShotWorkbench(nextWorkbench);
      setShotWorkflowPanel(nextWorkflowPanel);
      setErrorMessage("");
    });
    return nextWorkbench;
  }, []);

  const scheduleSilentRefresh = useCallback((
    stateRef: MutableRefObject<{ inFlight: boolean; queued: boolean }>,
    refresh: () => Promise<unknown>,
    scope: "shot" | "import",
  ) => {
    const state = stateRef.current;
    if (state.inFlight) {
      state.queued = true;
      return;
    }

    state.inFlight = true;
    const runRefresh = async () => {
      try {
        await refresh();
      } catch (error: unknown) {
        console.warn(`creator: ${scope} sse refresh failed`, error);
      } finally {
        if (state.queued) {
          state.queued = false;
          void runRefresh();
          return;
        }
        state.inFlight = false;
      }
    };

    void runRefresh();
  }, []);

  useEffect(() => {
    if (
      !shotWorkbench?.shotExecution.orgId ||
      !shotWorkbench.shotExecution.projectId ||
      importWorkbench?.importBatch.id
    ) {
      return;
    }

    return subscribeWorkbenchEvents({
      organizationId: shotWorkbench.shotExecution.orgId,
      projectId: shotWorkbench.shotExecution.projectId,
      workbenchKind: "shot",
      onRefreshNeeded: () => {
        scheduleSilentRefresh(shotRefreshStateRef, refreshShotWorkbench, "shot");
      },
      onError: (error) => {
        console.warn("creator: shot sse subscription failed", error);
      },
    });
  }, [
    importWorkbench?.importBatch.id,
    refreshShotWorkbench,
    scheduleSilentRefresh,
    shotWorkbench?.shotExecution.id,
    shotWorkbench?.shotExecution.orgId,
    shotWorkbench?.shotExecution.projectId,
  ]);

  useEffect(() => {
    if (
      !importWorkbench?.importBatch.orgId ||
      !importWorkbench.importBatch.projectId ||
      shotWorkbench?.shotExecution.id
    ) {
      return;
    }

    return subscribeWorkbenchEvents({
      organizationId: importWorkbench.importBatch.orgId,
      projectId: importWorkbench.importBatch.projectId,
      workbenchKind: "import",
      onRefreshNeeded: () => {
        scheduleSilentRefresh(importRefreshStateRef, refreshImportWorkbench, "import");
      },
      onError: (error) => {
        console.warn("creator: import sse subscription failed", error);
      },
    });
  }, [
    importWorkbench?.importBatch.id,
    importWorkbench?.importBatch.orgId,
    importWorkbench?.importBatch.projectId,
    refreshImportWorkbench,
    scheduleSilentRefresh,
    shotWorkbench?.shotExecution.id,
  ]);

  const runImportAction = async <T,>({
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
      setImportActionFeedback({
        tone: "pending",
        message: t(pendingMessageKey),
      });
    });

    try {
      await waitForFeedbackPaint();
      const result = await action();
      startTransition(() => {
        onSuccess?.(result);
        setImportActionFeedback(successFeedback ? successFeedback(result) : null);
      });
      return result;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "creator: unknown import workbench error";
      startTransition(() => {
        setImportActionFeedback({
          tone: "error",
          message: t(errorMessageKey, { message }),
        });
      });
      return null;
    }
  };

  const runShotAction = async ({
    pendingMessageKey,
    successMessageKey,
    errorMessageKey,
    unknownErrorMessage,
    action,
  }: {
    pendingMessageKey: CreatorMessageKey;
    successMessageKey: CreatorMessageKey;
    errorMessageKey: CreatorMessageKey;
    unknownErrorMessage: string;
    action: () => Promise<void>;
  }) => {
    startTransition(() => {
      setShotActionFeedback({
        tone: "pending",
        message: t(pendingMessageKey),
      });
    });

    try {
      await waitForFeedbackPaint();
      await action();
      startTransition(() => {
        setShotActionFeedback({
          tone: "success",
          message: t(successMessageKey),
        });
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : unknownErrorMessage;
      startTransition(() => {
        setShotActionFeedback({
          tone: "error",
          message: t(errorMessageKey, { message }),
        });
      });
      return false;
    }
  };

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>{t("app.error.load", { message: errorMessage })}</main>;
  }

  if (importWorkbench) {
    return (
      <ImportBatchWorkbenchPage
        workbench={importWorkbench}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        selectedUploadFile={selectedUploadFile}
        feedback={importActionFeedback ?? undefined}
        onChooseUploadFile={async (file) => {
          if (!file) {
            startTransition(() => {
              setSelectedUploadFile(null);
              setImportActionFeedback(null);
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
        }}
        onRegisterSelectedUpload={async () => {
          const { orgId, userId } = getRequestContext();

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
        }}
        onRetryUploadSession={async (sessionId) => {
          const { orgId, userId } = getRequestContext();
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
        }}
        onConfirmMatches={async (input) => {
          const { orgId, userId } = getRequestContext();
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
        }}
        onSelectPrimaryAsset={async (input) => {
          const { orgId, userId } = getRequestContext();
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
        }}
      />
    );
  }

  if (shotWorkbench) {
    return (
      <ShotWorkbenchPage
        workbench={shotWorkbench}
        workflowPanel={shotWorkflowPanel ?? undefined}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        feedback={shotActionFeedback ?? undefined}
        onRunSubmissionGateChecks={async (input) => {
          const { orgId, userId } = getRequestContext();

          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: t("feedback.pending.runGateChecks"),
            });
          });
          try {
            await waitForFeedbackPaint();
            const result = await runSubmissionGateChecks({
              ...input,
              orgId,
              userId,
            });
            const nextWorkbench = await refreshShotWorkbench();
            startTransition(() => {
              setShotActionFeedback(
                buildShotFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.runGateChecks",
                  passedChecks: result.passedChecks,
                  failedChecks: result.failedChecks,
                  latestConclusion: nextWorkbench.reviewSummary.latestConclusion,
                  latestEvaluationStatus: nextWorkbench.latestEvaluationRun?.status ?? "pending",
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown gate check error";
            startTransition(() => {
              setShotActionFeedback({
                tone: "error",
                message: t("feedback.error.runGateChecks", { message }),
              });
            });
          }
        }}
        onSubmitShotForReview={async (input) => {
          const { orgId, userId } = getRequestContext();

          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: t("feedback.pending.submitReview"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await submitShotForReview({
              ...input,
              orgId,
              userId,
            });
            const nextWorkbench = await refreshShotWorkbench();
            startTransition(() => {
              setShotActionFeedback(
                buildShotFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.submitReview",
                  latestConclusion: nextWorkbench.reviewSummary.latestConclusion,
                  latestEvaluationStatus: nextWorkbench.latestEvaluationRun?.status ?? "pending",
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown submit review error";
            startTransition(() => {
              setShotActionFeedback({
                tone: "error",
                message: t("feedback.error.submitReview", { message }),
              });
            });
          }
        }}
        onStartWorkflow={async (input) => {
          const { userId } = getRequestContext();
          await runShotAction({
            pendingMessageKey: "feedback.pending.startWorkflow",
            successMessageKey: "feedback.success.startWorkflow",
            errorMessageKey: "feedback.error.startWorkflow",
            unknownErrorMessage: "creator: unknown workflow start error",
            action: async () => {
              await startShotWorkflow({
                ...input,
                workflowType: "shot_pipeline",
                userId,
              });
              await refreshShotWorkbench();
            },
          });
        }}
        onRetryWorkflowRun={async (input) => {
          const { orgId, userId } = getRequestContext();
          await runShotAction({
            pendingMessageKey: "feedback.pending.retryWorkflow",
            successMessageKey: "feedback.success.retryWorkflow",
            errorMessageKey: "feedback.error.retryWorkflow",
            unknownErrorMessage: "creator: unknown workflow retry error",
            action: async () => {
              await retryShotWorkflowRun({
                ...input,
                orgId,
                userId,
              });
              await refreshShotWorkbench();
            },
          });
        }}
      />
    );
  }

  if (new URLSearchParams(window.location.search).get("importBatchId")) {
    return <main style={{ padding: "32px" }}>{t("app.loading.import")}</main>;
  }

  if (!shotWorkbench) {
    return <main style={{ padding: "32px" }}>{t("app.loading.shot")}</main>;
  }

  return (
    <ShotWorkbenchPage
      workbench={shotWorkbench}
      workflowPanel={shotWorkflowPanel ?? undefined}
      locale={locale}
      t={t}
      onLocaleChange={setLocale}
    />
  );
}
