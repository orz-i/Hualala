import type { MockTimestamp, MockWorkflowRun, MockWorkflowStep } from "./types.ts";

export function createTimestamp(seconds: number): MockTimestamp {
  return {
    seconds: String(seconds),
    nanos: 0,
  };
}

export function bumpTimestamp(
  timestamp: MockTimestamp | undefined,
  secondsToAdd = 300,
): MockTimestamp {
  const parsedSeconds = Number(timestamp?.seconds ?? 1710000000);
  const baseSeconds = Number.isFinite(parsedSeconds) ? parsedSeconds : 1710000000;
  return createTimestamp(baseSeconds + secondsToAdd);
}

export function createWorkflowSteps({
  workflowRunId,
  attemptCount,
  gatewayStatus,
  lastError,
}: {
  workflowRunId: string;
  attemptCount: number;
  gatewayStatus: "running" | "failed" | "cancelled";
  lastError: string;
}): MockWorkflowStep[] {
  const dispatchStart = 1710000000 + (attemptCount - 1) * 60;
  const gatewayStart = dispatchStart + 10;

  const steps: MockWorkflowStep[] = [
    {
      id: `${workflowRunId}-dispatch-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.dispatch`,
      stepOrder: 1,
      status: "completed",
      startedAt: createTimestamp(dispatchStart),
      completedAt: createTimestamp(dispatchStart + 5),
    },
    {
      id: `${workflowRunId}-gateway-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.gateway`,
      stepOrder: 2,
      status: gatewayStatus === "cancelled" ? "completed" : gatewayStatus,
      errorCode: gatewayStatus === "failed" ? "provider_error" : "",
      errorMessage: gatewayStatus === "failed" ? lastError : "",
      startedAt: createTimestamp(gatewayStart),
      completedAt:
        gatewayStatus === "running" || gatewayStatus === "failed"
          ? undefined
          : createTimestamp(gatewayStart + 5),
      failedAt: gatewayStatus === "failed" ? createTimestamp(gatewayStart + 5) : undefined,
    },
  ];

  if (gatewayStatus === "cancelled") {
    steps.push({
      id: `${workflowRunId}-cancel-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.cancel`,
      stepOrder: 3,
      status: "completed",
      startedAt: createTimestamp(gatewayStart + 6),
      completedAt: createTimestamp(gatewayStart + 8),
    });
  }

  return steps;
}

export function buildInitialWorkflowRuns({
  projectId,
  resourceId,
}: {
  projectId: string;
  resourceId: string;
}): MockWorkflowRun[] {
  return [
    {
      id: "workflow-run-1",
      workflowType: "shot_pipeline",
      status: "failed",
      resourceId,
      projectId,
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "provider rejected request",
      externalRequestId: "request-1",
      createdAt: createTimestamp(1710000000),
      updatedAt: createTimestamp(1710000300),
      steps: createWorkflowSteps({
        workflowRunId: "workflow-run-1",
        attemptCount: 1,
        gatewayStatus: "failed",
        lastError: "provider rejected request",
      }),
    },
  ];
}

export function summarizeWorkflowRun(record: MockWorkflowRun) {
  return {
    id: record.id,
    projectId: record.projectId,
    resourceId: record.resourceId,
    workflowType: record.workflowType,
    status: record.status,
    provider: record.provider,
    currentStep: record.currentStep,
    attemptCount: record.attemptCount,
    lastError: record.lastError,
    externalRequestId: record.externalRequestId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function startWorkflowRun(
  workflowRuns: MockWorkflowRun[],
  input: {
    workflowType?: string;
    resourceId: string;
    projectId: string;
  },
) {
  const nextIndex = workflowRuns.length + 1;
  const workflowRun: MockWorkflowRun = {
    id: `workflow-run-${nextIndex}`,
    workflowType: input.workflowType ?? "shot_pipeline",
    status: "running",
    resourceId: input.resourceId,
    projectId: input.projectId,
    provider: "seedance",
    currentStep: "attempt_1.gateway",
    attemptCount: 1,
    lastError: "",
    externalRequestId: `request-${nextIndex}`,
    createdAt: createTimestamp(1710000000 + workflowRuns.length * 60),
    updatedAt: createTimestamp(1710000005 + workflowRuns.length * 60),
    steps: createWorkflowSteps({
      workflowRunId: `workflow-run-${nextIndex}`,
      attemptCount: 1,
      gatewayStatus: "running",
      lastError: "",
    }),
  };

  return {
    workflowRun,
    workflowRuns: [workflowRun, ...clone(workflowRuns)],
  };
}

export function retryWorkflowRun(
  workflowRuns: MockWorkflowRun[],
  workflowRunId: string,
  options: { moveToFront?: boolean } = {},
) {
  const current = workflowRuns.find((run) => run.id === workflowRunId);
  if (!current) {
    return undefined;
  }

  const nextAttemptCount = current.attemptCount + 1;
  const workflowRun: MockWorkflowRun = {
    ...current,
    status: "running",
    currentStep: `attempt_${nextAttemptCount}.gateway`,
    attemptCount: nextAttemptCount,
    lastError: "",
    updatedAt: bumpTimestamp(current.updatedAt),
    steps: createWorkflowSteps({
      workflowRunId: current.id,
      attemptCount: nextAttemptCount,
      gatewayStatus: "running",
      lastError: "",
    }),
  };

  return replaceWorkflowRun(workflowRuns, workflowRun, options.moveToFront === true);
}

export function cancelWorkflowRun(
  workflowRuns: MockWorkflowRun[],
  workflowRunId: string,
  options: { moveToFront?: boolean } = {},
) {
  const current = workflowRuns.find((run) => run.id === workflowRunId);
  if (!current) {
    return undefined;
  }

  const workflowRun: MockWorkflowRun = {
    ...current,
    status: "cancelled",
    currentStep: `attempt_${current.attemptCount}.cancel`,
    lastError: "",
    updatedAt: bumpTimestamp(current.updatedAt),
    steps: createWorkflowSteps({
      workflowRunId: current.id,
      attemptCount: current.attemptCount,
      gatewayStatus: "cancelled",
      lastError: "",
    }),
  };

  return replaceWorkflowRun(workflowRuns, workflowRun, options.moveToFront === true);
}

function replaceWorkflowRun(
  workflowRuns: MockWorkflowRun[],
  nextWorkflowRun: MockWorkflowRun,
  moveToFront: boolean,
) {
  if (moveToFront) {
    return [
      nextWorkflowRun,
      ...workflowRuns
        .filter((run) => run.id !== nextWorkflowRun.id)
        .map((run) => clone(run)),
    ];
  }

  return workflowRuns.map((run) =>
    run.id === nextWorkflowRun.id ? nextWorkflowRun : clone(run),
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
