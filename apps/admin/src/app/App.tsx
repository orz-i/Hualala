import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocaleState } from "../i18n";
import {
  AdminOverviewPage,
  type AdminOverviewViewModel,
  type RecentChangeSummary,
} from "../features/dashboard/AdminOverviewPage";
import type {
  AssetMonitorViewModel,
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "../features/dashboard/assetMonitor";
import type { AdminGovernanceViewModel } from "../features/dashboard/governance";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { loadAssetMonitorPanel } from "../features/dashboard/loadAssetMonitorPanel";
import { loadAssetProvenanceDetails } from "../features/dashboard/loadAssetProvenanceDetails";
import { loadGovernancePanel } from "../features/dashboard/loadGovernancePanel";
import { loadImportBatchDetails } from "../features/dashboard/loadImportBatchDetails";
import { loadWorkflowMonitorPanel } from "../features/dashboard/loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "../features/dashboard/loadWorkflowRunDetails";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../features/dashboard/mutateAssetMonitor";
import {
  createRole,
  deleteRole,
  updateRole,
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "../features/dashboard/mutateGovernance";
import {
  cancelWorkflowRun,
  retryWorkflowRun,
} from "../features/dashboard/mutateWorkflowRun";
import { subscribeAdminRecentChanges } from "../features/dashboard/subscribeRecentChanges";
import {
  clearCurrentSession,
  ensureDevSession,
  isUnauthenticatedSessionError,
  loadCurrentSession,
  type SessionViewModel,
} from "../features/session/sessionBootstrap";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "../features/dashboard/workflow";

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

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

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unauthenticated">(
    "loading",
  );
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [governance, setGovernance] = useState<AdminGovernanceViewModel | null>(null);
  const [workflowMonitor, setWorkflowMonitor] = useState<WorkflowMonitorViewModel | null>(null);
  const [assetMonitor, setAssetMonitor] = useState<AssetMonitorViewModel | null>(null);
  const [workflowRunDetail, setWorkflowRunDetail] =
    useState<WorkflowRunDetailViewModel | null>(null);
  const [importBatchDetail, setImportBatchDetail] = useState<ImportBatchDetailViewModel | null>(
    null,
  );
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [selectedImportBatchId, setSelectedImportBatchId] = useState<string | null>(null);
  const [selectedAssetProvenanceId, setSelectedAssetProvenanceId] = useState<string | null>(null);
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<string[]>([]);
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState("");
  const [workflowTypeFilter, setWorkflowTypeFilter] = useState("");
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetSourceTypeFilter, setAssetSourceTypeFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);
  const [governanceActionFeedback, setGovernanceActionFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);
  const [governanceActionPending, setGovernanceActionPending] = useState(false);
  const [workflowActionFeedback, setWorkflowActionFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);
  const [workflowActionPending, setWorkflowActionPending] = useState(false);
  const [assetActionFeedback, setAssetActionFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);
  const [assetActionPending, setAssetActionPending] = useState(false);
  const workflowRefreshStateRef = useRef({
    running: false,
    queued: false,
  });
  const assetRefreshStateRef = useRef({
    running: false,
    queued: false,
  });
  const refreshWorkflowSilentlyRef = useRef<() => Promise<void>>(async () => {});
  const refreshAssetSilentlyRef = useRef<() => Promise<void>>(async () => {});

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("projectId") ?? "project-demo-001";
  const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";
  const overrideOrgId = searchParams.get("orgId") ?? undefined;
  const overrideUserId = searchParams.get("userId") ?? undefined;
  const identityOverride =
    overrideOrgId && overrideUserId
      ? {
          orgId: overrideOrgId,
          userId: overrideUserId,
        }
      : undefined;
  const subscriptionOrgId = overrideOrgId ?? session?.orgId;
  const effectiveOrgId = overrideOrgId ?? session?.orgId ?? "";
  const effectiveUserId = overrideUserId ?? session?.userId ?? "";

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

  const refreshWorkflowMonitor = useCallback(async () => {
    const nextWorkflowMonitor = await loadWorkflowMonitorPanel({
      projectId,
      status: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setWorkflowMonitor(nextWorkflowMonitor);
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

  const refreshAssetMonitor = useCallback(async () => {
    const nextAssetMonitor = await loadAssetMonitorPanel({
      projectId,
      status: assetStatusFilter,
      sourceType: assetSourceTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setAssetMonitor(nextAssetMonitor);
    });
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
  ]);

  const refreshImportBatchDetail = useCallback(
    async (importBatchId: string) => {
      const nextImportBatchDetail = await loadImportBatchDetails({
        importBatchId,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setImportBatchDetail(nextImportBatchDetail);
      });
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  const refreshAssetProvenanceDetail = useCallback(
    async (assetId: string) => {
      const nextAssetProvenanceDetail = await loadAssetProvenanceDetails({
        assetId,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setAssetProvenanceDetail(nextAssetProvenanceDetail);
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
    refreshWorkflowSilentlyRef.current = refreshWorkflowSilently;
  }, [refreshWorkflowSilently]);

  const refreshAssetSilently = useCallback(async () => {
    if (assetRefreshStateRef.current.running) {
      assetRefreshStateRef.current.queued = true;
      return;
    }

    assetRefreshStateRef.current.running = true;

    try {
      await refreshAssetMonitor();
      if (selectedImportBatchId) {
        await refreshImportBatchDetail(selectedImportBatchId);
      }
      if (selectedAssetProvenanceId) {
        await refreshAssetProvenanceDetail(selectedAssetProvenanceId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown asset refresh error";
      console.warn(message);
    } finally {
      assetRefreshStateRef.current.running = false;
      if (assetRefreshStateRef.current.queued) {
        assetRefreshStateRef.current.queued = false;
        void refreshAssetSilently();
      }
    }
  }, [
    refreshAssetMonitor,
    refreshAssetProvenanceDetail,
    refreshImportBatchDetail,
    selectedAssetProvenanceId,
    selectedImportBatchId,
  ]);

  useEffect(() => {
    refreshAssetSilentlyRef.current = refreshAssetSilently;
  }, [refreshAssetSilently]);

  const runAssetAction = useCallback(
    async ({
      pendingMessage,
      successMessage,
      execute,
      clearSelectionsOnSuccess = false,
    }: {
      pendingMessage: string;
      successMessage: string;
      execute: (input: {
        orgId: string;
        userId: string;
      }) => Promise<void>;
      clearSelectionsOnSuccess?: boolean;
    }) => {
      if (assetActionPending) {
        return;
      }

      startTransition(() => {
        setAssetActionPending(true);
        setAssetActionFeedback({
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
        await refreshAssetSilently();
        startTransition(() => {
          setAssetActionPending(false);
          setAssetActionFeedback({
            tone: "success",
            message: successMessage,
          });
          if (clearSelectionsOnSuccess) {
            setSelectedImportItemIds([]);
          }
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset action error";
        startTransition(() => {
          setAssetActionPending(false);
          setAssetActionFeedback({
            tone: "error",
            message: t("asset.action.error", { message }),
          });
        });
      }
    },
    [assetActionPending, effectiveOrgId, effectiveUserId, refreshAssetSilently, t],
  );

  const runGovernanceAction = useCallback(
    async ({
      pendingMessage,
      successMessage,
      execute,
    }: {
      pendingMessage: string;
      successMessage: string;
      execute: (input: {
        orgId: string;
        userId: string;
      }) => Promise<unknown>;
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
    let cancelled = false;

    startTransition(() => {
      setSessionState("loading");
      setSession(null);
      setErrorMessage("");
    });

    loadCurrentSession({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setSession(nextSession);
          setSessionState("ready");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isUnauthenticatedSessionError(error)) {
          startTransition(() => {
            setSession(null);
            setSessionState("unauthenticated");
          });
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown session bootstrap error";
        startTransition(() => {
          setErrorMessage(message);
          setSession(null);
          setSessionState("unauthenticated");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [identityOverride?.orgId, identityOverride?.userId]);

  useEffect(() => {
    if (sessionState === "ready") {
      return;
    }
    startTransition(() => {
      setOverview(null);
      setGovernance(null);
      setWorkflowMonitor(null);
      setAssetMonitor(null);
      setWorkflowRunDetail(null);
      setImportBatchDetail(null);
      setAssetProvenanceDetail(null);
      setSelectedWorkflowRunId(null);
      setSelectedImportBatchId(null);
      setSelectedAssetProvenanceId(null);
      setSelectedImportItemIds([]);
      setGovernanceActionFeedback(null);
      setGovernanceActionPending(false);
      setWorkflowActionFeedback(null);
      setWorkflowActionPending(false);
      setAssetActionFeedback(null);
      setAssetActionPending(false);
    });
  }, [sessionState]);

  useEffect(() => {
    if (sessionState !== "ready") {
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
        const message =
          error instanceof Error ? error.message : "admin: unknown overview error";
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

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }

    let cancelled = false;

    loadAssetMonitorPanel({
      projectId,
      status: assetStatusFilter,
      sourceType: assetSourceTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextAssetMonitor) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitor(nextAssetMonitor);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset monitor error";
        console.warn(message);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitor({
            filters: {
              status: assetStatusFilter,
              sourceType: assetSourceTypeFilter,
            },
            importBatches: [],
          });
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
    sessionState,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
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
          setWorkflowMonitor(nextWorkflowMonitor);
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
          setWorkflowMonitor({
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

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }
    if (!selectedImportBatchId) {
      startTransition(() => {
        setImportBatchDetail(null);
      });
      return;
    }

    let cancelled = false;
    loadImportBatchDetails({
      importBatchId: selectedImportBatchId,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextImportBatchDetail) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setImportBatchDetail(nextImportBatchDetail);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown import batch detail error";
        console.warn(message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    selectedImportBatchId,
    sessionState,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }
    if (!selectedAssetProvenanceId) {
      startTransition(() => {
        setAssetProvenanceDetail(null);
      });
      return;
    }

    let cancelled = false;
    loadAssetProvenanceDetails({
      assetId: selectedAssetProvenanceId,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextAssetProvenanceDetail) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetProvenanceDetail(nextAssetProvenanceDetail);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset provenance error";
        console.warn(message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    selectedAssetProvenanceId,
    sessionState,
  ]);

  useEffect(() => {
    if (sessionState !== "ready" || !overview || !subscriptionOrgId) {
      return;
    }

    return subscribeAdminRecentChanges({
      organizationId: subscriptionOrgId,
      projectId,
      onChange: (change) => {
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
      },
      onWorkflowUpdated: () => {
        void refreshWorkflowSilentlyRef.current();
      },
      onAssetImportBatchUpdated: () => {
        void refreshAssetSilentlyRef.current();
      },
      onError: (error) => {
        console.warn(error.message);
      },
    });
  }, [overview ? "ready" : "idle", projectId, sessionState, subscriptionOrgId]);

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

  const handleStartDevSession = useCallback(async () => {
    startTransition(() => {
      setSessionState("loading");
      setErrorMessage("");
    });
    try {
      const nextSession = await ensureDevSession();
      startTransition(() => {
        setSession(nextSession);
        setSessionState("ready");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown start session error";
      startTransition(() => {
        setErrorMessage(message);
        setSessionState("unauthenticated");
      });
    }
  }, []);

  const handleClearCurrentSession = useCallback(async () => {
    try {
      await clearCurrentSession();
      startTransition(() => {
        setSession(null);
        setSessionState("unauthenticated");
        setErrorMessage("");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown clear session error";
      startTransition(() => {
        setErrorMessage(message);
      });
    }
  }, []);

  if (errorMessage) {
    return (
      <main style={{ padding: "32px" }}>
        {t("app.error.load", { message: errorMessage })}
      </main>
    );
  }

  if (sessionState === "loading") {
    return <main style={{ padding: "32px" }}>{t("session.loading")}</main>;
  }

  if (sessionState === "unauthenticated") {
    return (
      <main style={{ padding: "32px", display: "grid", gap: "16px", maxWidth: "480px" }}>
        <h1 style={{ margin: 0 }}>{t("session.gate.title")}</h1>
        <p style={{ margin: 0 }}>{t("session.gate.description")}</p>
        <button
          type="button"
          onClick={() => {
            void handleStartDevSession();
          }}
          style={{
            width: "fit-content",
            border: 0,
            borderRadius: "999px",
            padding: "10px 18px",
            background: "#0f766e",
            color: "#f0fdfa",
            cursor: "pointer",
          }}
        >
          {t("session.gate.enter")}
        </button>
      </main>
    );
  }

  if (!overview || !governance) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  const effectiveWorkflowMonitor =
    workflowMonitor ??
    ({
      filters: {
        status: workflowStatusFilter,
        workflowType: workflowTypeFilter,
      },
      runs: [],
    } satisfies WorkflowMonitorViewModel);
  const effectiveAssetMonitor =
    assetMonitor ??
    ({
      filters: {
        status: assetStatusFilter,
        sourceType: assetSourceTypeFilter,
      },
      importBatches: [],
    } satisfies AssetMonitorViewModel);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          padding: "16px 24px 0",
        }}
      >
        <p style={{ margin: 0, color: "#334155" }}>
          {identityOverride
            ? t("session.override.active", { orgId: identityOverride.orgId, userId: identityOverride.userId })
            : t("session.active", { userId: session?.userId ?? "" })}
        </p>
        {!identityOverride ? (
          <button
            type="button"
            onClick={() => {
              void handleClearCurrentSession();
            }}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "8px 14px",
              background: "#cbd5e1",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            {t("session.clear")}
          </button>
        ) : null}
      </div>
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={effectiveWorkflowMonitor}
        assetMonitor={effectiveAssetMonitor}
        workflowRunDetail={workflowRunDetail}
        importBatchDetail={importBatchDetail}
        assetProvenanceDetail={assetProvenanceDetail}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        budgetFeedback={budgetFeedback ?? undefined}
        governanceActionFeedback={governanceActionFeedback ?? undefined}
        governanceActionPending={governanceActionPending}
        workflowActionFeedback={workflowActionFeedback ?? undefined}
        workflowActionPending={workflowActionPending}
        assetActionFeedback={assetActionFeedback ?? undefined}
        assetActionPending={assetActionPending}
        onUpdateBudgetLimit={async (input) => {
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
        }}
        onUpdateUserPreferences={(input) => {
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
        }}
        onUpdateMemberRole={(input) => {
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
        }}
        onUpdateOrgLocaleSettings={(input) => {
          void runGovernanceAction({
            pendingMessage: t("governance.action.locale.pending"),
            successMessage: t("governance.action.locale.success"),
            execute: (options) =>
              updateOrgLocaleSettings({
                ...options,
                defaultLocale: input.defaultLocale,
              }),
          });
        }}
        onCreateRole={(input) => {
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
        }}
        onUpdateRole={(input) => {
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
        }}
        onDeleteRole={(input) => {
          void runGovernanceAction({
            pendingMessage: t("governance.action.roles.delete.pending"),
            successMessage: t("governance.action.roles.delete.success"),
            execute: (options) =>
              deleteRole({
                ...options,
                roleId: input.roleId,
              }),
          });
        }}
        onWorkflowStatusFilterChange={(status) => {
          startTransition(() => {
            setWorkflowStatusFilter(status);
          });
        }}
        onWorkflowTypeFilterChange={(workflowType) => {
          startTransition(() => {
            setWorkflowTypeFilter(workflowType);
          });
        }}
        onAssetStatusFilterChange={(status) => {
          startTransition(() => {
            setAssetStatusFilter(status);
          });
        }}
        onAssetSourceTypeFilterChange={(sourceType) => {
          startTransition(() => {
            setAssetSourceTypeFilter(sourceType);
          });
        }}
        onSelectWorkflowRun={(workflowRunId) => {
          startTransition(() => {
            setSelectedWorkflowRunId(workflowRunId);
            setWorkflowActionFeedback(null);
          });
        }}
        onSelectImportBatch={(importBatchId) => {
          startTransition(() => {
            setSelectedImportBatchId(importBatchId);
            setSelectedAssetProvenanceId(null);
            setAssetProvenanceDetail(null);
            setSelectedImportItemIds([]);
            setAssetActionFeedback(null);
            setAssetActionPending(false);
          });
        }}
        onCloseImportBatchDetail={() => {
          startTransition(() => {
            setSelectedImportBatchId(null);
            setImportBatchDetail(null);
            setSelectedAssetProvenanceId(null);
            setAssetProvenanceDetail(null);
            setSelectedImportItemIds([]);
            setAssetActionFeedback(null);
            setAssetActionPending(false);
          });
        }}
        selectedImportItemIds={selectedImportItemIds}
        onToggleImportBatchItemSelection={({ itemId, checked }) => {
          startTransition(() => {
            setSelectedImportItemIds((current) => {
              if (checked) {
                return current.includes(itemId) ? current : [...current, itemId];
              }
              return current.filter((candidateId) => candidateId !== itemId);
            });
          });
        }}
        onConfirmImportBatchItem={({ importBatchId, itemId }) => {
          void runAssetAction({
            pendingMessage: t("asset.action.confirm.pending"),
            successMessage: t("asset.action.confirm.success"),
            clearSelectionsOnSuccess: true,
            execute: (options) =>
              confirmImportBatchItem({
                importBatchId,
                itemId,
                ...options,
              }),
          });
        }}
        onConfirmSelectedImportBatchItems={({ importBatchId, itemIds }) => {
          void runAssetAction({
            pendingMessage: t("asset.action.confirmSelected.pending"),
            successMessage: t("asset.action.confirmSelected.success"),
            clearSelectionsOnSuccess: true,
            execute: (options) =>
              confirmImportBatchItems({
                importBatchId,
                itemIds,
                ...options,
              }),
          });
        }}
        onConfirmAllImportBatchItems={({ importBatchId, itemIds }) => {
          if (itemIds.length === 0) {
            return;
          }

          void runAssetAction({
            pendingMessage: t("asset.action.confirmAll.pending"),
            successMessage: t("asset.action.confirmAll.success"),
            clearSelectionsOnSuccess: true,
            execute: (options) =>
              confirmImportBatchItems({
                importBatchId,
                itemIds,
                ...options,
              }),
          });
        }}
        onSelectPrimaryAsset={({ shotExecutionId, assetId }) => {
          void runAssetAction({
            pendingMessage: t("asset.action.selectPrimary.pending"),
            successMessage: t("asset.action.selectPrimary.success"),
            execute: (options) =>
              selectPrimaryAssetForImportBatch({
                shotExecutionId,
                assetId,
                ...options,
              }),
          });
        }}
        onSelectAssetProvenance={(assetId) => {
          startTransition(() => {
            setSelectedAssetProvenanceId(assetId);
          });
        }}
        onCloseAssetProvenance={() => {
          startTransition(() => {
            setSelectedAssetProvenanceId(null);
            setAssetProvenanceDetail(null);
          });
        }}
        onCloseWorkflowDetail={() => {
          startTransition(() => {
            setSelectedWorkflowRunId(null);
            setWorkflowRunDetail(null);
            setWorkflowActionFeedback(null);
            setWorkflowActionPending(false);
          });
        }}
        onRetryWorkflowRun={(workflowRunId) => {
          void runWorkflowAction({
            workflowRunId,
            pendingMessage: t("workflow.action.retry.pending"),
            successMessage: t("workflow.action.retry.success"),
            execute: retryWorkflowRun,
          });
        }}
        onCancelWorkflowRun={(workflowRunId) => {
          void runWorkflowAction({
            workflowRunId,
            pendingMessage: t("workflow.action.cancel.pending"),
            successMessage: t("workflow.action.cancel.success"),
            execute: cancelWorkflowRun,
          });
        }}
      />
    </>
  );
}
