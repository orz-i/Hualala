import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";
import {
  mapWorkflowRun,
  mapWorkflowStep,
  type WorkflowRunDetailViewModel,
} from "./workflow";

type LoadWorkflowRunDetailsOptions = {
  workflowRunId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function loadWorkflowRunDetails({
  workflowRunId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadWorkflowRunDetailsOptions): Promise<WorkflowRunDetailViewModel> {
  const client = createWorkflowClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = await client.getWorkflowRun({
    workflowRunId,
  });

  if (!payload.workflowRun?.id) {
    throw new Error("admin: workflow run detail payload is incomplete");
  }

  return {
    run: mapWorkflowRun({
      id: payload.workflowRun.id,
      projectId: payload.workflowRun.projectId,
      resourceId: payload.workflowRun.resourceId,
      workflowType: payload.workflowRun.workflowType,
      status: payload.workflowRun.status,
      provider: payload.workflowRun.provider,
      currentStep: payload.workflowRun.currentStep,
      attemptCount: payload.workflowRun.attemptCount,
      lastError: payload.workflowRun.lastError,
      externalRequestId: payload.workflowRun.externalRequestId,
      createdAt: payload.workflowRun.createdAt,
      updatedAt: payload.workflowRun.updatedAt,
    }),
    steps: (payload.workflowSteps ?? []).map((step) => mapWorkflowStep(step)),
  };
}
