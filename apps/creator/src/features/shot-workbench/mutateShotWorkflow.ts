import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";

type WorkflowClientOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type StartShotWorkflowInput = WorkflowClientOptions & {
  shotExecutionId: string;
  projectId: string;
  workflowType: string;
};

type RetryShotWorkflowRunInput = WorkflowClientOptions & {
  workflowRunId: string;
};

export async function startShotWorkflow({
  shotExecutionId,
  projectId,
  workflowType,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: StartShotWorkflowInput): Promise<void> {
  const client = createWorkflowClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.startWorkflow({
    organizationId: orgId ?? "",
    projectId,
    workflowType,
    resourceId: shotExecutionId,
  });
}

export async function retryShotWorkflowRun({
  workflowRunId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: RetryShotWorkflowRunInput): Promise<void> {
  const client = createWorkflowClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.retryWorkflowRun({
    workflowRunId,
  });
}
