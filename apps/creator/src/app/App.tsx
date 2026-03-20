import { startTransition, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import {
  ImportBatchWorkbenchPage,
  type ImportBatchWorkbenchViewModel,
} from "../features/import-batches/ImportBatchWorkbenchPage";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
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

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [importWorkbench, setImportWorkbench] = useState<ImportBatchWorkbenchViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [shotActionFeedback, setShotActionFeedback] = useState<ActionFeedbackModel | null>(null);
  const [importActionFeedback, setImportActionFeedback] = useState<ActionFeedbackModel | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const loadCurrentWorkbench = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const importBatchId = searchParams.get("importBatchId");
      const shotId = searchParams.get("shotId") ?? "shot-demo-001";
      return {
        importBatchId,
        load: importBatchId
          ? loadImportBatchWorkbench({ importBatchId })
          : loadShotWorkbench({ shotId }),
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
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshImportWorkbench = async () => {
    const importBatchId = new URLSearchParams(window.location.search).get("importBatchId");
    if (!importBatchId) {
      return;
    }
    const nextWorkbench = await loadImportBatchWorkbench({ importBatchId });
    startTransition(() => {
      setImportWorkbench(nextWorkbench);
      setErrorMessage("");
    });
    return nextWorkbench;
  };

  const refreshShotWorkbench = async () => {
    const shotId = new URLSearchParams(window.location.search).get("shotId") ?? "shot-demo-001";
    const nextWorkbench = await loadShotWorkbench({ shotId });
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
        feedback={importActionFeedback ?? undefined}
        onConfirmMatches={async (input) => {
          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.confirmMatches"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await confirmImportBatchItems(input);
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.confirmMatches",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
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
          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: t("feedback.pending.selectPrimary"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await selectPrimaryAssetForImportBatch(input);
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback(
                buildImportFeedback({
                  t,
                  tone: "success",
                  messageKey: "feedback.success.selectPrimary",
                  latestImportBatchStatus: nextWorkbench?.importBatch.status,
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
          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: t("feedback.pending.runGateChecks"),
            });
          });
          try {
            await waitForFeedbackPaint();
            const result = await runSubmissionGateChecks(input);
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
          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: t("feedback.pending.submitReview"),
            });
          });
          try {
            await waitForFeedbackPaint();
            await submitShotForReview(input);
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
