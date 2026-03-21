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
  ...options
}: WorkflowRunActionInput): Promise<void> {
  await createClient(options).retryWorkflowRun({
    workflowRunId,
  });
}

export async function cancelWorkflowRun({
  workflowRunId,
  ...options
}: WorkflowRunActionInput): Promise<void> {
  await createClient(options).cancelWorkflowRun({
    workflowRunId,
  });
}
