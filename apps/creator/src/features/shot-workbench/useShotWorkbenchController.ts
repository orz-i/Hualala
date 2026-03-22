import { startTransition, useCallback, useEffect, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import { subscribeWorkbenchEvents } from "../subscribeWorkbenchEvents";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { buildShotFeedback } from "../shared/buildActionFeedback";
import { useQueuedSilentRefresh } from "../shared/useQueuedSilentRefresh";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import { loadShotReviewTimeline } from "./loadShotReviewTimeline";
import { loadShotWorkflowPanel } from "./loadShotWorkflowPanel";
import { loadShotWorkbench } from "./loadShotWorkbench";
import {
  runSubmissionGateChecks,
  submitShotForReview,
} from "./mutateShotWorkbench";
import { retryShotWorkflowRun, startShotWorkflow } from "./mutateShotWorkflow";
import type {
  ShotWorkbenchViewModel,
  ShotWorkflowPanelViewModel,
} from "./ShotWorkbenchPage";

type UseShotWorkbenchControllerOptions = {
  enabled: boolean;
  shotId: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
};

function formatActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    const json = JSON.stringify(error);
    if (typeof json === "string" && json && json !== "{}") {
      return json;
    }
  } catch {
    // Ignore JSON stringification failures and fall through to String().
  }

  const stringified = String(error);
  if (stringified && stringified !== "[object Object]" && stringified !== "undefined") {
    return stringified;
  }

  return fallback;
}

async function loadShotWorkbenchState({
  shotId,
  t,
  orgId,
  userId,
}: {
  shotId: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
}) {
  const nextWorkbench = await loadShotWorkbench({
    shotId,
    orgId,
    userId,
  });
  const [nextWorkflowPanel, nextReviewTimeline] = await Promise.all([
    loadShotWorkflowPanel({
      shotExecutionId: nextWorkbench.shotExecution.id,
      projectId: nextWorkbench.shotExecution.projectId,
      orgId,
      userId,
    }),
    loadShotReviewTimeline({
      shotExecutionId: nextWorkbench.shotExecution.id,
      orgId,
      userId,
      unavailableMessage: t("shot.timeline.unavailable"),
    }),
  ]);

  return {
    shotWorkbench: {
      ...nextWorkbench,
      reviewTimeline: nextReviewTimeline,
    },
    shotWorkflowPanel: nextWorkflowPanel,
  };
}

export function useShotWorkbenchController({
  enabled,
  shotId,
  t,
  orgId,
  userId,
}: UseShotWorkbenchControllerOptions) {
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [shotWorkflowPanel, setShotWorkflowPanel] =
    useState<ShotWorkflowPanelViewModel | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshShotWorkbench = useCallback(async () => {
    const nextState = await loadShotWorkbenchState({
      shotId,
      t,
      orgId,
      userId,
    });

    startTransition(() => {
      setShotWorkbench(nextState.shotWorkbench);
      setShotWorkflowPanel(nextState.shotWorkflowPanel);
      setErrorMessage("");
    });

    return nextState.shotWorkbench;
  }, [orgId, shotId, t, userId]);

  const scheduleSilentRefresh = useQueuedSilentRefresh("shot", refreshShotWorkbench);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setShotWorkbench(null);
        setShotWorkflowPanel(null);
        setFeedback(null);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    loadShotWorkbenchState({
      shotId,
      t,
      orgId,
      userId,
    })
      .then((nextState) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setShotWorkbench(nextState.shotWorkbench);
          setShotWorkflowPanel(nextState.shotWorkflowPanel);
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
          setShotWorkbench(null);
          setShotWorkflowPanel(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, shotId, t, userId]);

  useEffect(() => {
    if (
      !enabled ||
      !shotWorkbench?.shotExecution.orgId ||
      !shotWorkbench.shotExecution.projectId
    ) {
      return;
    }

    return subscribeWorkbenchEvents({
      organizationId: shotWorkbench.shotExecution.orgId,
      projectId: shotWorkbench.shotExecution.projectId,
      workbenchKind: "shot",
      onRefreshNeeded: scheduleSilentRefresh,
      onError: (error) => {
        console.warn("creator: shot sse subscription failed", error);
      },
    });
  }, [
    enabled,
    scheduleSilentRefresh,
    shotWorkbench?.shotExecution.id,
    shotWorkbench?.shotExecution.orgId,
    shotWorkbench?.shotExecution.projectId,
  ]);

  const runShotAction = useCallback(
    async ({
      pendingMessage,
      unknownErrorMessage,
      action,
      onSuccess,
      onError,
    }: {
      pendingMessage: string;
      unknownErrorMessage: string;
      action: () => Promise<unknown>;
      onSuccess: () => void;
      onError: (message: string) => void;
    }) => {
      startTransition(() => {
        setFeedback({
          tone: "pending",
          message: pendingMessage,
        });
      });

      try {
        await waitForFeedbackPaint();
        await action();
        startTransition(() => {
          onSuccess();
        });
      } catch (error: unknown) {
        const message = formatActionErrorMessage(error, unknownErrorMessage);
        startTransition(() => {
          onError(message);
        });
      }
    },
    [],
  );

  const handleRunSubmissionGateChecks = useCallback(
    async (input: { shotExecutionId: string }) => {
      await runShotAction({
        pendingMessage: t("feedback.pending.runGateChecks"),
        unknownErrorMessage: "creator: unknown gate check error",
        action: async () => {
          const result = await runSubmissionGateChecks({
            ...input,
            orgId,
            userId,
          });
          const nextWorkbench = await refreshShotWorkbench();
          startTransition(() => {
            setFeedback(
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
        },
        onSuccess: () => {},
        onError: (message) => {
          setFeedback({
            tone: "error",
            message: t("feedback.error.runGateChecks", { message }),
          });
        },
      });
    },
    [orgId, refreshShotWorkbench, runShotAction, t, userId],
  );

  const handleSubmitShotForReview = useCallback(
    async (input: { shotExecutionId: string }) => {
      await runShotAction({
        pendingMessage: t("feedback.pending.submitReview"),
        unknownErrorMessage: "creator: unknown submit review error",
        action: async () => {
          await submitShotForReview({
            ...input,
            orgId,
            userId,
          });
          const nextWorkbench = await refreshShotWorkbench();
          startTransition(() => {
            setFeedback(
              buildShotFeedback({
                t,
                tone: "success",
                messageKey: "feedback.success.submitReview",
                latestConclusion: nextWorkbench.reviewSummary.latestConclusion,
                latestEvaluationStatus: nextWorkbench.latestEvaluationRun?.status ?? "pending",
              }),
            );
          });
        },
        onSuccess: () => {},
        onError: (message) => {
          setFeedback({
            tone: "error",
            message: t("feedback.error.submitReview", { message }),
          });
        },
      });
    },
    [orgId, refreshShotWorkbench, runShotAction, t, userId],
  );

  const handleStartWorkflow = useCallback(
    async (input: { shotExecutionId: string; projectId: string; orgId: string }) => {
      await runShotAction({
        pendingMessage: t("feedback.pending.startWorkflow"),
        unknownErrorMessage: "creator: unknown workflow start error",
        action: async () => {
          await startShotWorkflow({
            ...input,
            workflowType: "shot_pipeline",
            userId,
          });
          await refreshShotWorkbench();
        },
        onSuccess: () => {
          setFeedback({
            tone: "success",
            message: t("feedback.success.startWorkflow"),
          });
        },
        onError: (message) => {
          setFeedback({
            tone: "error",
            message: t("feedback.error.startWorkflow", { message }),
          });
        },
      });
    },
    [refreshShotWorkbench, runShotAction, t, userId],
  );

  const handleRetryWorkflowRun = useCallback(
    async (input: { workflowRunId: string }) => {
      await runShotAction({
        pendingMessage: t("feedback.pending.retryWorkflow"),
        unknownErrorMessage: "creator: unknown workflow retry error",
        action: async () => {
          await retryShotWorkflowRun({
            ...input,
            orgId,
            userId,
          });
          await refreshShotWorkbench();
        },
        onSuccess: () => {
          setFeedback({
            tone: "success",
            message: t("feedback.success.retryWorkflow"),
          });
        },
        onError: (message) => {
          setFeedback({
            tone: "error",
            message: t("feedback.error.retryWorkflow", { message }),
          });
        },
      });
    },
    [orgId, refreshShotWorkbench, runShotAction, t, userId],
  );

  return {
    shotWorkbench,
    shotWorkflowPanel,
    feedback,
    errorMessage,
    handleRunSubmissionGateChecks,
    handleSubmitShotForReview,
    handleStartWorkflow,
    handleRetryWorkflowRun,
  };
}
