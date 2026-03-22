import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import { loadWorkflowMonitorPanel } from "./loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "./loadWorkflowRunDetails";
import { cancelWorkflowRun, retryWorkflowRun } from "./mutateWorkflowRun";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "./workflow";
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

export function useAdminWorkflowController({
  sessionState,
  projectId,
  identityOverride,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  identityOverride: IdentityOverride;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [workflowMonitorState, setWorkflowMonitorState] =
    useState<WorkflowMonitorViewModel | null>(null);
  const [workflowRunDetail, setWorkflowRunDetail] =
    useState<WorkflowRunDetailViewModel | null>(null);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState("");
  const [workflowTypeFilter, setWorkflowTypeFilter] = useState("");
  const [workflowActionFeedback, setWorkflowActionFeedback] = useState<ActionFeedback>(null);
  const [workflowActionPending, setWorkflowActionPending] = useState(false);
  const workflowRefreshStateRef = useRef({
    running: false,
    queued: false,
  });

  const refreshWorkflowMonitor = useCallback(async () => {
    const nextWorkflowMonitor = await loadWorkflowMonitorPanel({
      projectId,
      status: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setWorkflowMonitorState(nextWorkflowMonitor);
    });
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
    workflowStatusFilter,
    workflowTypeFilter,
  ]);

  const refreshWorkflowRunDetail = useCallback(
    async (workflowRunId: string) => {
      const nextWorkflowRunDetail = await loadWorkflowRunDetails({
        workflowRunId,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setWorkflowRunDetail(nextWorkflowRunDetail);
      });
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  const refreshWorkflowSilently = useCallback(async () => {
    if (workflowRefreshStateRef.current.running) {
      workflowRefreshStateRef.current.queued = true;
      return;
    }

    workflowRefreshStateRef.current.running = true;

    try {
      await refreshWorkflowMonitor();
      if (selectedWorkflowRunId) {
        await refreshWorkflowRunDetail(selectedWorkflowRunId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown workflow refresh error";
      console.warn(message);
    } finally {
      workflowRefreshStateRef.current.running = false;
      if (workflowRefreshStateRef.current.queued) {
        workflowRefreshStateRef.current.queued = false;
        void refreshWorkflowSilently();
      }
    }
  }, [refreshWorkflowMonitor, refreshWorkflowRunDetail, selectedWorkflowRunId]);

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setWorkflowMonitorState(null);
        setWorkflowRunDetail(null);
        setSelectedWorkflowRunId(null);
        setWorkflowActionFeedback(null);
        setWorkflowActionPending(false);
      });
      return;
    }

    let cancelled = false;

    loadWorkflowMonitorPanel({
      projectId,
      status: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextWorkflowMonitor) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setWorkflowMonitorState(nextWorkflowMonitor);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown workflow monitor error";
        console.warn(message);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setWorkflowMonitorState({
            filters: {
              status: workflowStatusFilter,
              workflowType: workflowTypeFilter,
            },
            runs: [],
          });
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
    workflowStatusFilter,
    workflowTypeFilter,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }
    if (!selectedWorkflowRunId) {
      startTransition(() => {
        setWorkflowRunDetail(null);
      });
      return;
    }

    let cancelled = false;
    loadWorkflowRunDetails({
      workflowRunId: selectedWorkflowRunId,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextWorkflowRunDetail) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setWorkflowRunDetail(nextWorkflowRunDetail);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown workflow detail error";
        console.warn(message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    selectedWorkflowRunId,
    sessionState,
  ]);

  const runWorkflowAction = useCallback(
    async ({
      workflowRunId,
      pendingMessage,
      successMessage,
      execute,
    }: {
      workflowRunId: string;
      pendingMessage: string;
      successMessage: string;
      execute: (input: {
        workflowRunId: string;
        orgId: string;
        userId: string;
      }) => Promise<void>;
    }) => {
      if (workflowActionPending) {
        return;
      }

      startTransition(() => {
        setWorkflowActionPending(true);
        setWorkflowActionFeedback({
          tone: "pending",
          message: pendingMessage,
        });
      });

      try {
        await waitForFeedbackPaint();
        await execute({
          workflowRunId,
          orgId: effectiveOrgId,
          userId: effectiveUserId,
        });
        await refreshWorkflowSilently();
        startTransition(() => {
          setWorkflowActionPending(false);
          setWorkflowActionFeedback({
            tone: "success",
            message: successMessage,
          });
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown workflow action error";
        startTransition(() => {
          setWorkflowActionPending(false);
          setWorkflowActionFeedback({
            tone: "error",
            message: t("workflow.action.error", { message }),
          });
        });
      }
    },
    [
      effectiveOrgId,
      effectiveUserId,
      refreshWorkflowSilently,
      t,
      workflowActionPending,
    ],
  );

  return {
    workflowMonitor:
      workflowMonitorState ??
      ({
        filters: {
          status: workflowStatusFilter,
          workflowType: workflowTypeFilter,
        },
        runs: [],
      } satisfies WorkflowMonitorViewModel),
    workflowRunDetail,
    selectedWorkflowRunId,
    workflowActionFeedback,
    workflowActionPending,
    refreshWorkflowSilently,
    onWorkflowStatusFilterChange: (status: string) => {
      startTransition(() => {
        setWorkflowStatusFilter(status);
      });
    },
    onWorkflowTypeFilterChange: (workflowType: string) => {
      startTransition(() => {
        setWorkflowTypeFilter(workflowType);
      });
    },
    onSelectWorkflowRun: (workflowRunId: string) => {
      startTransition(() => {
        setSelectedWorkflowRunId(workflowRunId);
        setWorkflowActionFeedback(null);
      });
    },
    onCloseWorkflowDetail: () => {
      startTransition(() => {
        setSelectedWorkflowRunId(null);
        setWorkflowRunDetail(null);
        setWorkflowActionFeedback(null);
        setWorkflowActionPending(false);
      });
    },
    onRetryWorkflowRun: (workflowRunId: string) =>
      runWorkflowAction({
        workflowRunId,
        pendingMessage: t("workflow.action.retry.pending"),
        successMessage: t("workflow.action.retry.success"),
        execute: retryWorkflowRun,
      }),
    onCancelWorkflowRun: (workflowRunId: string) =>
      runWorkflowAction({
        workflowRunId,
        pendingMessage: t("workflow.action.cancel.pending"),
        successMessage: t("workflow.action.cancel.success"),
        execute: cancelWorkflowRun,
      }),
  };
}
