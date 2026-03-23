import type { HualalaFetch } from "@hualala/sdk";
import type { AssetMonitorViewModel, ImportBatchSummaryViewModel } from "./assetMonitor";
import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAdminOverview } from "./loadAdminOverview";
import type {
  AdminOperationsOverviewViewModel,
  AdminReleaseBlockerSummary,
  AdminRuntimeHealthAlert,
} from "./operationsOverview";
import type { AdminOverviewViewModel } from "./overview";
import { loadWorkflowMonitorPanel } from "./loadWorkflowMonitorPanel";
import type { WorkflowMonitorViewModel, WorkflowRunSummaryViewModel } from "./workflow";

type LoadAdminOperationsOverviewOptions = {
  projectId: string;
  shotExecutionId: string;
  orgId?: string;
  userId?: string;
  overview?: AdminOverviewViewModel;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

const MAX_RUNTIME_ALERTS = 3;

function getFailedWorkflowRuns(workflowMonitor: WorkflowMonitorViewModel) {
  return workflowMonitor.runs.filter((run) => run.status === "failed");
}

function getRunningWorkflowRuns(workflowMonitor: WorkflowMonitorViewModel) {
  return workflowMonitor.runs.filter((run) => run.status === "running");
}

function getUnconfirmedItemCount(batch: ImportBatchSummaryViewModel) {
  return Math.max(batch.itemCount - batch.confirmedItemCount, 0);
}

function isPendingImportBatch(batch: ImportBatchSummaryViewModel) {
  return getUnconfirmedItemCount(batch) > 0 || batch.status !== "confirmed";
}

function isBlockedImportBatch(batch: ImportBatchSummaryViewModel) {
  return batch.mediaAssetCount <= 0 || batch.status !== "confirmed";
}

function buildReleaseBlockers({
  overview,
  failedWorkflowRuns,
  pendingImportBatches,
  blockedImportBatches,
}: {
  overview: AdminOverviewViewModel;
  failedWorkflowRuns: WorkflowRunSummaryViewModel[];
  pendingImportBatches: ImportBatchSummaryViewModel[];
  blockedImportBatches: ImportBatchSummaryViewModel[];
}): AdminReleaseBlockerSummary[] {
  const blockers: AdminReleaseBlockerSummary[] = [];
  const latestEvaluation = overview.evaluationRuns[0];
  const latestReviewConclusion =
    overview.shotReviews[0]?.conclusion ?? overview.reviewSummary.latestConclusion;
  const primaryAssetBatch = blockedImportBatches[0] ?? pendingImportBatches[0];

  if (overview.budgetSnapshot.remainingBudgetCents <= 0) {
    blockers.push({
      id: "budget",
      kind: "budget",
      status: "blocked",
      remainingBudgetCents: overview.budgetSnapshot.remainingBudgetCents,
    });
  }

  if (latestEvaluation?.status !== "passed" || latestReviewConclusion !== "approved") {
    blockers.push({
      id: "review",
      kind: "review",
      status: "blocked",
      latestEvaluationStatus: latestEvaluation?.status ?? "pending",
      latestReviewConclusion,
      failedChecksCount: latestEvaluation?.failedChecks.length ?? 0,
    });
  }

  if (failedWorkflowRuns.length > 0) {
    const latestFailedWorkflow = failedWorkflowRuns[0];
    blockers.push({
      id: "workflow",
      kind: "workflow",
      status: "blocked",
      failedWorkflowCount: failedWorkflowRuns.length,
      workflowRunId: latestFailedWorkflow?.id,
      workflowType: latestFailedWorkflow?.workflowType,
      lastError: latestFailedWorkflow?.lastError,
      target: latestFailedWorkflow
        ? {
            route: "workflow",
            workflowRunId: latestFailedWorkflow.id,
          }
        : undefined,
    });
  }

  if (primaryAssetBatch) {
    blockers.push({
      id: "asset",
      kind: "asset",
      status: "blocked",
      pendingConfirmationCount: pendingImportBatches.length,
      blockedImportBatchCount: blockedImportBatches.length,
      importBatchId: primaryAssetBatch.id,
      batchStatus: primaryAssetBatch.status,
      unconfirmedItemCount: getUnconfirmedItemCount(primaryAssetBatch),
      missingMediaAssetCount: primaryAssetBatch.mediaAssetCount <= 0 ? 1 : 0,
      target: {
        route: "assets",
        importBatchId: primaryAssetBatch.id,
      },
    });
  }

  return blockers;
}

function buildRuntimeAlerts({
  failedWorkflowRuns,
  runningWorkflowRuns,
  pendingImportBatches,
  blockedImportBatches,
}: {
  failedWorkflowRuns: WorkflowRunSummaryViewModel[];
  runningWorkflowRuns: WorkflowRunSummaryViewModel[];
  pendingImportBatches: ImportBatchSummaryViewModel[];
  blockedImportBatches: ImportBatchSummaryViewModel[];
}): AdminRuntimeHealthAlert[] {
  const alerts: AdminRuntimeHealthAlert[] = [];

  if (failedWorkflowRuns.length > 0) {
    const latestFailedWorkflow = failedWorkflowRuns[0];
    alerts.push({
      id: "workflow-failed",
      kind: "workflow_failed",
      count: failedWorkflowRuns.length,
      workflowRunId: latestFailedWorkflow?.id,
      workflowType: latestFailedWorkflow?.workflowType,
      lastError: latestFailedWorkflow?.lastError,
      target: latestFailedWorkflow
        ? {
            route: "workflow",
            workflowRunId: latestFailedWorkflow.id,
          }
        : undefined,
    });
  }

  if (runningWorkflowRuns.length > 0) {
    const runningWorkflow = runningWorkflowRuns[0];
    alerts.push({
      id: "workflow-running",
      kind: "workflow_running",
      count: runningWorkflowRuns.length,
      workflowRunId: runningWorkflow?.id,
      workflowType: runningWorkflow?.workflowType,
      target: runningWorkflow
        ? {
            route: "workflow",
            workflowRunId: runningWorkflow.id,
          }
        : undefined,
    });
  }

  if (pendingImportBatches.length > 0 || blockedImportBatches.length > 0) {
    const primaryAssetBatch = blockedImportBatches[0] ?? pendingImportBatches[0];
    alerts.push({
      id: "asset-attention",
      kind: "asset_attention",
      count: Math.max(pendingImportBatches.length, blockedImportBatches.length),
      importBatchId: primaryAssetBatch?.id,
      batchStatus: primaryAssetBatch?.status,
      pendingConfirmationCount: pendingImportBatches.length,
      blockedImportBatchCount: blockedImportBatches.length,
      target: primaryAssetBatch
        ? {
            route: "assets",
            importBatchId: primaryAssetBatch.id,
          }
        : undefined,
    });
  }

  return alerts.slice(0, MAX_RUNTIME_ALERTS);
}

export function buildAdminOperationsOverview({
  overview,
  workflowMonitor,
  assetMonitor,
}: {
  overview: AdminOverviewViewModel;
  workflowMonitor: WorkflowMonitorViewModel;
  assetMonitor: AssetMonitorViewModel;
}): AdminOperationsOverviewViewModel {
  const failedWorkflowRuns = getFailedWorkflowRuns(workflowMonitor);
  const runningWorkflowRuns = getRunningWorkflowRuns(workflowMonitor);
  const pendingImportBatches = assetMonitor.importBatches.filter(isPendingImportBatch);
  const blockedImportBatches = assetMonitor.importBatches.filter(isBlockedImportBatch);
  const blockers = buildReleaseBlockers({
    overview,
    failedWorkflowRuns,
    pendingImportBatches,
    blockedImportBatches,
  });

  return {
    blockerCount: blockers.filter((blocker) => blocker.status === "blocked").length,
    blockers,
    runtimeHealth: {
      runningWorkflowCount: runningWorkflowRuns.length,
      failedWorkflowCount: failedWorkflowRuns.length,
      pendingImportBatchCount: pendingImportBatches.length,
      blockedImportBatchCount: blockedImportBatches.length,
      alerts: buildRuntimeAlerts({
        failedWorkflowRuns,
        runningWorkflowRuns,
        pendingImportBatches,
        blockedImportBatches,
      }),
    },
  };
}

export async function loadAdminOperationsOverview({
  projectId,
  shotExecutionId,
  orgId,
  userId,
  overview,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminOperationsOverviewOptions): Promise<AdminOperationsOverviewViewModel> {
  const [nextOverview, workflowMonitor, assetMonitor] = await Promise.all([
    overview
      ? Promise.resolve(overview)
      : loadAdminOverview({
          projectId,
          shotExecutionId,
          baseUrl,
          fetchFn,
        }),
    loadWorkflowMonitorPanel({
      projectId,
      status: "",
      workflowType: "",
      orgId,
      userId,
      baseUrl,
      fetchFn,
    }),
    loadAssetMonitorPanel({
      projectId,
      status: "",
      sourceType: "",
      orgId,
      userId,
      baseUrl,
      fetchFn,
    }),
  ]);

  return buildAdminOperationsOverview({
    overview: nextOverview,
    workflowMonitor,
    assetMonitor,
  });
}
