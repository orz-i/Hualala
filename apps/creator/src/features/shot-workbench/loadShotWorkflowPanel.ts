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
  const payload = await client.listWorkflowRuns({
    projectId,
    resourceId: shotExecutionId,
  });
  const latestWorkflowRun = payload.workflowRuns?.[0];

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
