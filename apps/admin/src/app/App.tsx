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
import type { AdminGovernanceViewModel } from "../features/dashboard/governance";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { loadGovernancePanel } from "../features/dashboard/loadGovernancePanel";
import { loadWorkflowMonitorPanel } from "../features/dashboard/loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "../features/dashboard/loadWorkflowRunDetails";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import {
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "../features/dashboard/mutateGovernance";
import { subscribeAdminRecentChanges } from "../features/dashboard/subscribeRecentChanges";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "../features/dashboard/workflow";

function waitForFeedbackPaint() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function buildFallbackGovernance(orgId?: string, userId?: string): AdminGovernanceViewModel {
  const fallbackOrgId = orgId ?? "org-dev-fallback";
  const fallbackUserId = userId ?? "user-dev-fallback";
  const locale = "zh-CN";

  return {
    currentSession: {
      sessionId: `dev:${fallbackOrgId}:${fallbackUserId}`,
      orgId: fallbackOrgId,
      userId: fallbackUserId,
      locale,
    },
    userPreferences: {
      userId: fallbackUserId,
      displayLocale: locale,
      timezone: "",
    },
    members: [],
    roles: [],
    orgLocaleSettings: {
      orgId: fallbackOrgId,
      defaultLocale: locale,
      supportedLocales: [locale],
    },
  };
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
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [governance, setGovernance] = useState<AdminGovernanceViewModel | null>(null);
  const [workflowMonitor, setWorkflowMonitor] = useState<WorkflowMonitorViewModel | null>(null);
  const [workflowRunDetail, setWorkflowRunDetail] =
    useState<WorkflowRunDetailViewModel | null>(null);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState("");
  const [workflowTypeFilter, setWorkflowTypeFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [budgetFeedback, setBudgetFeedback] = useState<{
    tone: "pending" | "success" | "error";
    message: string;
  } | null>(null);
  const workflowRefreshStateRef = useRef({
    running: false,
    queued: false,
  });
  const refreshWorkflowSilentlyRef = useRef<() => Promise<void>>(async () => {});

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("projectId") ?? "project-demo-001";
  const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";
  const orgId = searchParams.get("orgId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const subscriptionOrgId = orgId ?? governance?.currentSession.orgId;

  const refreshOverview = useCallback(async () => {
    const nextOverview = await loadAdminOverview({ projectId, shotExecutionId });
    startTransition(() => {
      setOverview(nextOverview);
      setErrorMessage("");
    });
  }, [projectId, shotExecutionId]);

  const refreshGovernance = useCallback(async () => {
    const nextGovernance = await loadGovernancePanel({ orgId, userId });
    startTransition(() => {
      setGovernance(nextGovernance);
    });
  }, [orgId, userId]);

  const refreshWorkflowMonitor = useCallback(async () => {
    const nextWorkflowMonitor = await loadWorkflowMonitorPanel({
      projectId,
      status: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      orgId,
      userId,
    });
    startTransition(() => {
      setWorkflowMonitor(nextWorkflowMonitor);
    });
  }, [orgId, projectId, userId, workflowStatusFilter, workflowTypeFilter]);

  const refreshWorkflowRunDetail = useCallback(
    async (workflowRunId: string) => {
      const nextWorkflowRunDetail = await loadWorkflowRunDetails({
        workflowRunId,
        orgId,
        userId,
      });
      startTransition(() => {
        setWorkflowRunDetail(nextWorkflowRunDetail);
      });
    },
    [orgId, userId],
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

  useEffect(() => {
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

    loadGovernancePanel({ orgId, userId })
      .then((nextGovernance) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setGovernance(nextGovernance);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setGovernance(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, projectId, shotExecutionId, userId]);

  useEffect(() => {
    let cancelled = false;

    loadWorkflowMonitorPanel({
      projectId,
      status: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      orgId,
      userId,
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
  }, [orgId, projectId, userId, workflowStatusFilter, workflowTypeFilter]);

  useEffect(() => {
    if (!selectedWorkflowRunId) {
      startTransition(() => {
        setWorkflowRunDetail(null);
      });
      return;
    }

    let cancelled = false;
    loadWorkflowRunDetails({
      workflowRunId: selectedWorkflowRunId,
      orgId,
      userId,
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
  }, [orgId, selectedWorkflowRunId, userId]);

  useEffect(() => {
    if (!overview || !subscriptionOrgId) {
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
      onError: (error) => {
        console.warn(error.message);
      },
    });
  }, [overview ? "ready" : "idle", projectId, subscriptionOrgId]);

  if (errorMessage) {
    return (
      <main style={{ padding: "32px" }}>
        {t("app.error.load", { message: errorMessage })}
      </main>
    );
  }

  if (!overview) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  const effectiveGovernance = governance ?? buildFallbackGovernance(orgId, userId);
  const effectiveOrgId = orgId ?? effectiveGovernance.currentSession.orgId;
  const effectiveUserId = userId ?? effectiveGovernance.currentSession.userId;
  const effectiveWorkflowMonitor =
    workflowMonitor ??
    ({
      filters: {
        status: workflowStatusFilter,
        workflowType: workflowTypeFilter,
      },
      runs: [],
    } satisfies WorkflowMonitorViewModel);

  return (
    <AdminOverviewPage
      overview={overview}
      governance={effectiveGovernance}
      workflowMonitor={effectiveWorkflowMonitor}
      workflowRunDetail={workflowRunDetail}
      locale={locale}
      t={t}
      onLocaleChange={setLocale}
      budgetFeedback={budgetFeedback ?? undefined}
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
      onUpdateUserPreferences={async (input) => {
        await updateUserPreferences({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          displayLocale: input.displayLocale,
          timezone: input.timezone,
        });
        await refreshGovernance();
      }}
      onUpdateMemberRole={async (input) => {
        await updateMemberRole({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          memberId: input.memberId,
          roleId: input.roleId,
        });
        await refreshGovernance();
      }}
      onUpdateOrgLocaleSettings={async (input) => {
        await updateOrgLocaleSettings({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
          defaultLocale: input.defaultLocale,
        });
        await refreshGovernance();
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
      onSelectWorkflowRun={(workflowRunId) => {
        startTransition(() => {
          setSelectedWorkflowRunId(workflowRunId);
        });
      }}
      onCloseWorkflowDetail={() => {
        startTransition(() => {
          setSelectedWorkflowRunId(null);
          setWorkflowRunDetail(null);
        });
      }}
    />
  );
}
