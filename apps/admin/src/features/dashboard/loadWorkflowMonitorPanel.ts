import { createWorkflowClient, type HualalaFetch } from "@hualala/sdk";
import {
  mapWorkflowRun,
  type WorkflowMonitorViewModel,
} from "./workflow";

type LoadWorkflowMonitorPanelOptions = {
  projectId: string;
  status?: string;
  workflowType?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function loadWorkflowMonitorPanel({
  projectId,
  status = "",
  workflowType = "",
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadWorkflowMonitorPanelOptions): Promise<WorkflowMonitorViewModel> {
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
    status,
    workflowType,
  });

  return {
    filters: {
      status,
      workflowType,
    },
    runs: (payload.workflowRuns ?? []).map((run) =>
      mapWorkflowRun({
        id: run.id,
        projectId: run.projectId,
        resourceId: run.resourceId,
        workflowType: run.workflowType,
        status: run.status,
        provider: run.provider,
        currentStep: run.currentStep,
        attemptCount: run.attemptCount,
        lastError: run.lastError,
        externalRequestId: run.externalRequestId,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      }),
    ),
  };
}
