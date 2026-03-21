import { loadWorkflowMonitorPanel } from "./loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "./loadWorkflowRunDetails";

describe("workflow monitor loaders", () => {
  it("maps workflow runs and keeps applied filters", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.workflow.v1.WorkflowService/ListWorkflowRuns")) {
        return new Response(
          JSON.stringify({
            workflowRuns: [
              {
                id: "workflow-run-2",
                projectId: "project-live-1",
                resourceId: "shot-exec-live-2",
                workflowType: "shot_pipeline",
                status: "failed",
                provider: "seedance",
                currentStep: "attempt_2.gateway",
                attemptCount: 2,
                lastError: "gateway timeout",
                externalRequestId: "request-2",
                createdAt: { seconds: "1710000000", nanos: 0 },
                updatedAt: { seconds: "1710000300", nanos: 0 },
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    const result = await loadWorkflowMonitorPanel({
      projectId: "project-live-1",
      status: "failed",
      workflowType: "shot_pipeline",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.filters.status).toBe("failed");
    expect(result.filters.workflowType).toBe("shot_pipeline");
    expect(result.runs[0]).toMatchObject({
      id: "workflow-run-2",
      projectId: "project-live-1",
      resourceId: "shot-exec-live-2",
      status: "failed",
      provider: "seedance",
      currentStep: "attempt_2.gateway",
      attemptCount: 2,
      lastError: "gateway timeout",
      externalRequestId: "request-2",
    });
    expect(result.runs[0]?.createdAt).toBe("2024-03-09T16:00:00.000Z");
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.workflow.v1.WorkflowService/ListWorkflowRuns",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-live-1",
          status: "failed",
          workflowType: "shot_pipeline",
        }),
      }),
    );
  });

  it("loads workflow run details with ordered steps", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.workflow.v1.WorkflowService/GetWorkflowRun")) {
        return new Response(
          JSON.stringify({
            workflowRun: {
              id: "workflow-run-9",
              projectId: "project-live-1",
              resourceId: "shot-exec-live-9",
              workflowType: "shot_pipeline",
              status: "failed",
              provider: "seedance",
              currentStep: "attempt_1.gateway",
              attemptCount: 1,
              lastError: "provider rejected request",
              externalRequestId: "request-9",
              createdAt: { seconds: "1710000000", nanos: 0 },
              updatedAt: { seconds: "1710000300", nanos: 0 },
            },
            workflowSteps: [
              {
                id: "step-1",
                workflowRunId: "workflow-run-9",
                stepKey: "attempt_1.dispatch",
                stepOrder: 1,
                status: "completed",
                startedAt: { seconds: "1710000000", nanos: 0 },
                completedAt: { seconds: "1710000010", nanos: 0 },
              },
              {
                id: "step-2",
                workflowRunId: "workflow-run-9",
                stepKey: "attempt_1.gateway",
                stepOrder: 2,
                status: "failed",
                errorCode: "provider_error",
                errorMessage: "provider rejected request",
                startedAt: { seconds: "1710000011", nanos: 0 },
                failedAt: { seconds: "1710000300", nanos: 0 },
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    const result = await loadWorkflowRunDetails({
      workflowRunId: "workflow-run-9",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.run.id).toBe("workflow-run-9");
    expect(result.run.lastError).toBe("provider rejected request");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.stepKey).toBe("attempt_1.dispatch");
    expect(result.steps[1]?.errorCode).toBe("provider_error");
    expect(result.steps[1]?.failedAt).toBe("2024-03-09T16:05:00.000Z");
  });
});
