import { startTransition, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
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
import {
  runSubmissionGateChecks,
  submitShotForReview,
} from "../features/shot-workbench/mutateShotWorkbench";
import type { ActionFeedbackModel } from "../features/shared/ActionFeedback";
import {
  buildImportFeedback,
  buildShotFeedback,
} from "../features/shared/buildActionFeedback";
import { ShotWorkbenchPage, type ShotWorkbenchViewModel } from "../features/shot-workbench/ShotWorkbenchPage";

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

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [importWorkbench, setImportWorkbench] = useState<ImportBatchWorkbenchViewModel | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<SelectedUploadFileState | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [shotActionFeedback, setShotActionFeedback] = useState<ActionFeedbackModel | null>(null);
  const [importActionFeedback, setImportActionFeedback] = useState<ActionFeedbackModel | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const loadCurrentWorkbench = () => {
      const { importBatchId, shotId, orgId, userId } = getRequestContext();
      return {
        importBatchId,
        load: importBatchId
          ? loadImportBatchWorkbench({ importBatchId, orgId, userId })
          : loadShotWorkbench({ shotId, orgId, userId }),
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
          } else {
            setShotWorkbench(nextWorkbench as ShotWorkbenchViewModel);
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
          setImportWorkbench(null);
          setSelectedUploadFile(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshImportWorkbench = async () => {
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
  };

  const refreshShotWorkbench = async () => {
    const { shotId, orgId, userId } = getRequestContext();
    const nextWorkbench = await loadShotWorkbench({ shotId, orgId, userId });
    startTransition(() => {
      setShotWorkbench(nextWorkbench);
      setErrorMessage("");
    });
    return nextWorkbench;
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

          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.readUploadFile"),
            });
          });

          try {
            await waitForFeedbackPaint();
            const derived = await deriveUploadFileMetadata(file);
            startTransition(() => {
              setSelectedUploadFile(derived);
              setImportActionFeedback(null);
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown upload file read error";
            startTransition(() => {
              setSelectedUploadFile(null);
              setImportActionFeedback({
                tone: "error",
                message: t("feedback.error.readUploadFile", { message }),
              });
            });
          }
        }}
        onRegisterSelectedUpload={async () => {
          const { orgId, userId } = getRequestContext();

          if (!importWorkbench || !selectedUploadFile) {
            return;
          }

          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.registerUpload"),
            });
          });

          try {
            await waitForFeedbackPaint();
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
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setSelectedUploadFile(null);
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.registerUpload",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
                  latestUploadSessionStatus:
                    nextWorkbench?.uploadSessions.at(-1)?.status ?? "pending",
                  latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                  latestPrimaryAssetId: nextWorkbench?.shotExecutions[0]?.primaryAssetId,
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown register upload error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: t("feedback.error.registerUpload", { message }),
              });
            });
          }
        }}
        onRetryUploadSession={async (sessionId) => {
          const { orgId, userId } = getRequestContext();

          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.retryUpload"),
            });
          });

          try {
            await waitForFeedbackPaint();
            await retryUploadSessionForImportBatch({
              sessionId,
              orgId,
              userId,
            });
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.retryUpload",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
                  latestUploadSessionStatus:
                    nextWorkbench?.uploadSessions.at(-1)?.status ?? "pending",
                  latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                  latestPrimaryAssetId: nextWorkbench?.shotExecutions[0]?.primaryAssetId,
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown retry upload error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: t("feedback.error.retryUpload", { message }),
              });
            });
          }
        }}
        onConfirmMatches={async (input) => {
          const { orgId, userId } = getRequestContext();

          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.confirmMatches"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await confirmImportBatchItems({
              ...input,
              orgId,
              userId,
            });
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.confirmMatches",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
                  latestUploadSessionStatus:
                    nextWorkbench?.uploadSessions.at(-1)?.status ?? "pending",
                  latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                  latestPrimaryAssetId: nextWorkbench?.shotExecutions[0]?.primaryAssetId,
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown confirm matches error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: t("feedback.error.confirmMatches", { message }),
              });
            });
          }
        }}
        onSelectPrimaryAsset={async (input) => {
          const { orgId, userId } = getRequestContext();

          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.selectPrimary"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await selectPrimaryAssetForImportBatch({
              ...input,
              orgId,
              userId,
            });
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.selectPrimary",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
                  latestUploadSessionStatus:
                    nextWorkbench?.uploadSessions.at(-1)?.status ?? "pending",
                  latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                  latestPrimaryAssetId: nextWorkbench?.shotExecutions[0]?.primaryAssetId,
                }),
              );
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown select primary error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: t("feedback.error.selectPrimary", { message }),
              });
            });
          }
        }}
      />
    );
  }

  if (shotWorkbench) {
    return (
      <ShotWorkbenchPage
        workbench={shotWorkbench}
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
      locale={locale}
      t={t}
      onLocaleChange={setLocale}
    />
  );
}
