export type AdminOperationsRouteTarget =
  | {
      route: "workflow";
      workflowRunId?: string;
    }
  | {
      route: "assets";
      importBatchId?: string;
    };

export type AdminReleaseBlockerSummary =
  | {
      id: "budget";
      kind: "budget";
      status: "blocked" | "insufficient";
      remainingBudgetCents: number;
    }
  | {
      id: "review";
      kind: "review";
      status: "blocked" | "insufficient";
      latestEvaluationStatus: string;
      latestReviewConclusion: string;
      failedChecksCount: number;
    }
  | {
      id: "workflow";
      kind: "workflow";
      status: "blocked" | "insufficient";
      failedWorkflowCount: number;
      workflowRunId?: string;
      workflowType?: string;
      lastError?: string;
      target?: AdminOperationsRouteTarget;
    }
  | {
      id: "asset";
      kind: "asset";
      status: "blocked" | "insufficient";
      pendingConfirmationCount: number;
      blockedImportBatchCount: number;
      importBatchId?: string;
      batchStatus?: string;
      unconfirmedItemCount?: number;
      missingMediaAssetCount?: number;
      target?: AdminOperationsRouteTarget;
    };

export type AdminRuntimeHealthAlert =
  | {
      id: "workflow-running";
      kind: "workflow_running";
      count: number;
      workflowRunId?: string;
      workflowType?: string;
      target?: AdminOperationsRouteTarget;
    }
  | {
      id: "workflow-failed";
      kind: "workflow_failed";
      count: number;
      workflowRunId?: string;
      workflowType?: string;
      lastError?: string;
      target?: AdminOperationsRouteTarget;
    }
  | {
      id: "asset-attention";
      kind: "asset_attention";
      count: number;
      importBatchId?: string;
      batchStatus?: string;
      pendingConfirmationCount: number;
      blockedImportBatchCount: number;
      target?: AdminOperationsRouteTarget;
    };

export type AdminRuntimeHealthSummary = {
  runningWorkflowCount: number;
  failedWorkflowCount: number;
  pendingImportBatchCount: number;
  blockedImportBatchCount: number;
  alerts: AdminRuntimeHealthAlert[];
};

export type AdminOperationsOverviewViewModel = {
  blockerCount: number;
  blockers: AdminReleaseBlockerSummary[];
  runtimeHealth: AdminRuntimeHealthSummary;
};
