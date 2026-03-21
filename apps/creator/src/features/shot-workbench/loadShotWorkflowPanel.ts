import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";
import type { ShotWorkflowPanelViewModel } from "./ShotWorkbenchPage";

type LoadShotWorkflowPanelOptions = {
  projectId: string;
  shotExecutionId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ListWorkflowRunsResponse = {
  workflowRuns?: Array<{
    id?: string;
    workflowType?: string;
    status?: string;
    resourceId?: string;
    projectId?: string;
  }>;
};

export async function loadShotWorkflowPanel({
  projectId,
  shotExecutionId,
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
  const payload = (await client.listWorkflowRuns({
    projectId,
  })) as ListWorkflowRunsResponse;

  const latestWorkflowRun = (payload.workflowRuns ?? []).find(
    (record) => record.resourceId === shotExecutionId,
  );

  if (!latestWorkflowRun?.id) {
    return {
      latestWorkflowRun: undefined,
    };
  }

  return {
    latestWorkflowRun: {
      id: latestWorkflowRun.id,
      workflowType: latestWorkflowRun.workflowType ?? "unknown",
      status: latestWorkflowRun.status ?? "pending",
      resourceId: latestWorkflowRun.resourceId ?? "",
      projectId: latestWorkflowRun.projectId ?? projectId,
    },
  };
}
