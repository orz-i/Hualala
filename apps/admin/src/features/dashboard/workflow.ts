export type WorkflowMonitorFiltersViewModel = {
  status: string;
  workflowType: string;
};

export type WorkflowRunSummaryViewModel = {
  id: string;
  projectId: string;
  resourceId: string;
  workflowType: string;
  status: string;
  provider: string;
  currentStep: string;
  attemptCount: number;
  lastError: string;
  externalRequestId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStepViewModel = {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  errorCode: string;
  errorMessage: string;
  startedAt: string;
  completedAt: string;
  failedAt: string;
};

export type WorkflowRunDetailViewModel = {
  run: WorkflowRunSummaryViewModel;
  steps: WorkflowStepViewModel[];
};

export type WorkflowMonitorViewModel = {
  filters: WorkflowMonitorFiltersViewModel;
  runs: WorkflowRunSummaryViewModel[];
};

type ProtoTimestampLike = {
  seconds?: string | number | bigint;
  nanos?: number;
} | null | undefined;

function toTimestampString(value: ProtoTimestampLike) {
  if (!value?.seconds) {
    return "";
  }

  const seconds = Number(value.seconds);
  const nanos = value.nanos ?? 0;

  if (!Number.isFinite(seconds)) {
    return "";
  }

  return new Date(seconds * 1000 + nanos / 1_000_000).toISOString();
}

export function mapWorkflowRun(run: {
  id?: string;
  projectId?: string;
  resourceId?: string;
  workflowType?: string;
  status?: string;
  provider?: string;
  currentStep?: string;
  attemptCount?: number;
  lastError?: string;
  externalRequestId?: string;
  createdAt?: ProtoTimestampLike;
  updatedAt?: ProtoTimestampLike;
}): WorkflowRunSummaryViewModel {
  return {
    id: run.id ?? "",
    projectId: run.projectId ?? "",
    resourceId: run.resourceId ?? "",
    workflowType: run.workflowType ?? "unknown",
    status: run.status ?? "pending",
    provider: run.provider ?? "unknown",
    currentStep: run.currentStep ?? "pending",
    attemptCount: run.attemptCount ?? 0,
    lastError: run.lastError ?? "",
    externalRequestId: run.externalRequestId ?? "",
    createdAt: toTimestampString(run.createdAt),
    updatedAt: toTimestampString(run.updatedAt),
  };
}

export function mapWorkflowStep(step: {
  id?: string;
  workflowRunId?: string;
  stepKey?: string;
  stepOrder?: number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: ProtoTimestampLike;
  completedAt?: ProtoTimestampLike;
  failedAt?: ProtoTimestampLike;
}): WorkflowStepViewModel {
  return {
    id: step.id ?? "",
    workflowRunId: step.workflowRunId ?? "",
    stepKey: step.stepKey ?? "unknown",
    stepOrder: step.stepOrder ?? 0,
    status: step.status ?? "pending",
    errorCode: step.errorCode ?? "",
    errorMessage: step.errorMessage ?? "",
    startedAt: toTimestampString(step.startedAt),
    completedAt: toTimestampString(step.completedAt),
    failedAt: toTimestampString(step.failedAt),
  };
}
