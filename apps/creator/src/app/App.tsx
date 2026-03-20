import { startTransition, useEffect, useState } from "react";
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
import { ShotWorkbenchPage, type ShotWorkbenchViewModel } from "../features/shot-workbench/ShotWorkbenchPage";

type ShotActionFeedback = {
  tone: "success" | "error" | "pending";
  message: string;
  passedChecks?: string[];
  failedChecks?: string[];
  latestConclusion?: string;
  latestEvaluationStatus?: string;
};

type ImportActionFeedback = {
  tone: "success" | "error" | "pending";
  message: string;
  latestImportBatchStatus?: string;
  latestShotExecutionStatus?: string;
  latestPrimaryAssetId?: string;
};

export function App() {
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [importWorkbench, setImportWorkbench] = useState<ImportBatchWorkbenchViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [shotActionFeedback, setShotActionFeedback] = useState<ShotActionFeedback | null>(null);
  const [importActionFeedback, setImportActionFeedback] = useState<ImportActionFeedback | null>(
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
    return <main style={{ padding: "32px" }}>工作台加载失败：{errorMessage}</main>;
  }

  if (importWorkbench) {
    return (
      <ImportBatchWorkbenchPage
        workbench={importWorkbench}
        feedback={importActionFeedback ?? undefined}
        onConfirmMatches={async (input) => {
          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: "正在确认匹配",
            });
          });
          try {
            await confirmImportBatchItems(input);
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback({
                tone: "success",
                message: "匹配确认已完成",
                latestImportBatchStatus: nextWorkbench?.importBatch.status,
                latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                latestPrimaryAssetId:
                  nextWorkbench?.shotExecutions[0]?.primaryAssetId || undefined,
              });
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown confirm matches error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: `匹配确认失败：${message}`,
              });
            });
          }
        }}
        onSelectPrimaryAsset={async (input) => {
          startTransition(() => {
            setImportActionFeedback({
              tone: "pending",
              message: "正在设为主素材",
            });
          });
          try {
            await selectPrimaryAssetForImportBatch(input);
            const nextWorkbench = await refreshImportWorkbench();
            startTransition(() => {
              setImportActionFeedback({
                tone: "success",
                message: "主素材选择已完成",
                latestImportBatchStatus: nextWorkbench?.importBatch.status,
                latestShotExecutionStatus: nextWorkbench?.shotExecutions[0]?.status ?? "pending",
                latestPrimaryAssetId:
                  nextWorkbench?.shotExecutions[0]?.primaryAssetId || undefined,
              });
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown select primary error";
            startTransition(() => {
              setImportActionFeedback({
                tone: "error",
                message: `主素材选择失败：${message}`,
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
        feedback={shotActionFeedback ?? undefined}
        onRunSubmissionGateChecks={async (input) => {
          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: "正在执行 Gate 检查",
            });
          });
          try {
            const result = await runSubmissionGateChecks(input);
            const nextWorkbench = await refreshShotWorkbench();
            startTransition(() => {
              setShotActionFeedback({
                tone: "success",
                message: "Gate 检查已完成",
                passedChecks: result.passedChecks,
                failedChecks: result.failedChecks,
                latestConclusion: nextWorkbench.reviewSummary.latestConclusion,
                latestEvaluationStatus: nextWorkbench.latestEvaluationRun?.status ?? "pending",
              });
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown gate check error";
            startTransition(() => {
              setShotActionFeedback({
                tone: "error",
                message: `Gate 检查失败：${message}`,
              });
            });
          }
        }}
        onSubmitShotForReview={async (input) => {
          startTransition(() => {
            setShotActionFeedback({
              tone: "pending",
              message: "正在提交评审",
            });
          });
          try {
            await submitShotForReview(input);
            const nextWorkbench = await refreshShotWorkbench();
            startTransition(() => {
              setShotActionFeedback({
                tone: "success",
                message: "提交评审已完成",
                latestConclusion: nextWorkbench.reviewSummary.latestConclusion,
                latestEvaluationStatus: nextWorkbench.latestEvaluationRun?.status ?? "pending",
              });
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "creator: unknown submit review error";
            startTransition(() => {
              setShotActionFeedback({
                tone: "error",
                message: `提交评审失败：${message}`,
              });
            });
          }
        }}
      />
    );
  }

  if (new URLSearchParams(window.location.search).get("importBatchId")) {
    return <main style={{ padding: "32px" }}>正在加载导入工作台</main>;
  }

  if (!shotWorkbench) {
    return <main style={{ padding: "32px" }}>正在加载镜头工作台</main>;
  }

  return <ShotWorkbenchPage workbench={shotWorkbench} />;
}
