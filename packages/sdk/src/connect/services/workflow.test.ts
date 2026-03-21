import { describe, expect, it, vi } from "vitest";
import { createWorkflowClient } from "./workflow";

describe("createWorkflowClient", () => {
  it("calls workflow unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workflowRun: {
              id: "workflow-run-1",
              workflowType: "shot_pipeline",
              status: "running",
              resourceId: "shot-exec-1",
              projectId: "project-1",
              provider: "seedance",
              currentStep: "attempt_1.gateway",
              attemptCount: 1,
              lastError: "",
              externalRequestId: "external-request-1",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workflowRun: {
              id: "workflow-run-1",
              workflowType: "shot_pipeline",
              status: "running",
              resourceId: "shot-exec-1",
              projectId: "project-1",
              provider: "seedance",
              currentStep: "attempt_1.gateway",
              attemptCount: 1,
              lastError: "",
              externalRequestId: "external-request-1",
            },
            workflowSteps: [
              {
                id: "workflow-step-1",
                workflowRunId: "workflow-run-1",
                stepKey: "attempt_1.dispatch",
                stepOrder: 1,
                status: "completed",
              },
              {
                id: "workflow-step-2",
                workflowRunId: "workflow-run-1",
                stepKey: "attempt_1.gateway",
                stepOrder: 2,
                status: "running",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workflowRuns: [
              {
                id: "workflow-run-1",
                workflowType: "shot_pipeline",
                status: "running",
                resourceId: "shot-exec-1",
                projectId: "project-1",
                provider: "seedance",
                currentStep: "attempt_1.gateway",
                attemptCount: 1,
                externalRequestId: "external-request-1",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const client = createWorkflowClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        orgId: "org-1",
        userId: "user-1",
      },
    });

    await client.startWorkflow({
      organizationId: "org-1",
      projectId: "project-1",
      workflowType: "shot_pipeline",
      resourceId: "shot-exec-1",
    });
    const fetched = await client.getWorkflowRun({
      workflowRunId: "workflow-run-1",
    });
    expect(fetched.workflowSteps?.[0]?.stepKey).toBe("attempt_1.dispatch");
    expect(fetched.workflowRun?.currentStep).toBe("attempt_1.gateway");

    await client.listWorkflowRuns({
      projectId: "project-1",
      resourceId: "shot-exec-1",
      status: "running",
      workflowType: "shot_pipeline",
    });
    await client.cancelWorkflowRun({
      workflowRunId: "workflow-run-1",
    });
    await client.retryWorkflowRun({
      workflowRunId: "workflow-run-1",
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.workflow.v1.WorkflowService/StartWorkflow",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
        body: JSON.stringify({
          organizationId: "org-1",
          projectId: "project-1",
          workflowType: "shot_pipeline",
          resourceId: "shot-exec-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/hualala.workflow.v1.WorkflowService/ListWorkflowRuns",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          resourceId: "shot-exec-1",
          status: "running",
          workflowType: "shot_pipeline",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:8080/hualala.workflow.v1.WorkflowService/RetryWorkflowRun",
      expect.objectContaining({
        body: JSON.stringify({
          workflowRunId: "workflow-run-1",
        }),
      }),
    );
  });
});
