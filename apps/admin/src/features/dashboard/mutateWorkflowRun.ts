import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";

type WorkflowMutationOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type WorkflowRunActionInput = WorkflowMutationOptions & {
  workflowRunId: string;
};

function createClient(options: WorkflowMutationOptions) {
  return createWorkflowClient({
    baseUrl: options.baseUrl,
    fetchFn: options.fetchFn,
    identity: {
      orgId: options.orgId,
      userId: options.userId,
    },
  });
}

export async function retryWorkflowRun({
  workflowRunId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: WorkflowRunActionInput): Promise<void> {
  await createClient({ orgId, userId, baseUrl, fetchFn }).retryWorkflowRun({
    workflowRunId,
  });
}

export async function cancelWorkflowRun({
  workflowRunId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: WorkflowRunActionInput): Promise<void> {
  await createClient({ orgId, userId, baseUrl, fetchFn }).cancelWorkflowRun({
    workflowRunId,
  });
}
