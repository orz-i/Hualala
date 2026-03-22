import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";
import type { ShotWorkflowPanelViewModel } from "./ShotWorkbenchPage";

type LoadShotWorkflowPanelOptions = {
  projectId: string;
  shotExecutionId: string;
  detailUnavailableMessage?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type WorkflowRunLike = {
  id?: string;
  workflowType?: string;
  status?: string;
  resourceId?: string;
  projectId?: string;
  provider?: string;
  currentStep?: string;
  attemptCount?: number;
  lastError?: string;
  externalRequestId?: string;
};

type WorkflowStepLike = {
  id?: string;
  workflowRunId?: string;
  stepKey?: string;
  stepOrder?: number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
};

function mapWorkflowRun(
  record: WorkflowRunLike,
  fallbackProjectId: string,
): NonNullable<ShotWorkflowPanelViewModel["latestWorkflowRun"]> {
  return {
    id: record.id ?? "",
    workflowType: record.workflowType ?? "unknown",
    status: record.status ?? "pending",
    resourceId: record.resourceId ?? "",
    projectId: record.projectId ?? fallbackProjectId,
    provider: record.provider ?? "unknown",
    currentStep: record.currentStep ?? "pending",
    attemptCount: record.attemptCount ?? 0,
    lastError: record.lastError ?? "",
    externalRequestId: record.externalRequestId ?? "",
  };
}

function mapWorkflowStep(record: WorkflowStepLike) {
  return {
    id: record.id ?? "",
    workflowRunId: record.workflowRunId ?? "",
    stepKey: record.stepKey ?? "unknown",
    stepOrder: record.stepOrder ?? 0,
    status: record.status ?? "pending",
    errorCode: record.errorCode ?? "",
    errorMessage: record.errorMessage ?? "",
  };
}

export async function loadShotWorkflowPanel({
  projectId,
  shotExecutionId,
  detailUnavailableMessage,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadShotWorkflowPanelOptions): Promise<ShotWorkflowPanelViewModel> {
  const client = createWorkflowClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  const payload = await client.listWorkflowRuns({
    projectId,
    resourceId: shotExecutionId,
  });
  const latestWorkflowRun = payload.workflowRuns?.[0];

  if (!latestWorkflowRun?.id) {
    return {
      latestWorkflowRun: undefined,
      workflowSteps: [],
      detailUnavailableMessage: undefined,
    };
  }

  const latestWorkflowRunSummary = mapWorkflowRun(latestWorkflowRun, projectId);

  try {
    const detailPayload = await client.getWorkflowRun({
      workflowRunId: latestWorkflowRun.id,
    });

    return {
      latestWorkflowRun: detailPayload.workflowRun?.id
        ? mapWorkflowRun(detailPayload.workflowRun, projectId)
        : latestWorkflowRunSummary,
      workflowSteps: (detailPayload.workflowSteps ?? []).map((step) =>
        mapWorkflowStep(step),
      ),
      detailUnavailableMessage: undefined,
    };
  } catch (error) {
    console.warn("creator: failed to load workflow run details", {
      workflowRunId: latestWorkflowRun.id,
      error,
    });
    return {
      latestWorkflowRun: latestWorkflowRunSummary,
      workflowSteps: [],
      detailUnavailableMessage:
        detailUnavailableMessage ?? "creator: workflow detail unavailable",
    };
  }

}
