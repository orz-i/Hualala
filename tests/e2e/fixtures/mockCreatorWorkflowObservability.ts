import type { Page } from "@playwright/test";

type MockWorkflowStep = {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  errorCode: string;
  errorMessage: string;
};

type MockWorkflowRun = {
  id: string;
  workflowType: string;
  status: string;
  resourceId: string;
  projectId: string;
  provider: string;
  currentStep: string;
  attemptCount: number;
  lastError: string;
  externalRequestId: string;
  steps: MockWorkflowStep[];
};

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildWorkflowSteps({
  workflowRunId,
  attemptCount,
  gatewayStatus,
  lastError,
}: {
  workflowRunId: string;
  attemptCount: number;
  gatewayStatus: string;
  lastError: string;
}): MockWorkflowStep[] {
  return [
    {
      id: `${workflowRunId}-dispatch-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.dispatch`,
      stepOrder: 1,
      status: "completed",
      errorCode: "",
      errorMessage: "",
    },
    {
      id: `${workflowRunId}-gateway-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.gateway`,
      stepOrder: 2,
      status: gatewayStatus,
      errorCode: lastError ? "provider_error" : "",
      errorMessage: lastError,
    },
  ];
}

function summarizeWorkflowRun(workflowRun: MockWorkflowRun) {
  return {
    id: workflowRun.id,
    workflowType: workflowRun.workflowType,
    status: workflowRun.status,
    resourceId: workflowRun.resourceId,
    projectId: workflowRun.projectId,
    provider: workflowRun.provider,
    currentStep: workflowRun.currentStep,
    attemptCount: workflowRun.attemptCount,
    lastError: workflowRun.lastError,
    externalRequestId: workflowRun.externalRequestId,
  };
}

export async function mockCreatorWorkflowObservabilityRoutes(page: Page) {
  let workflowRuns: MockWorkflowRun[] = [
    {
      id: "workflow-run-1",
      workflowType: "shot_pipeline",
      status: "failed",
      resourceId: "shot-exec-live-1",
      projectId: "project-live-1",
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "provider rejected request",
      externalRequestId: "request-1",
      steps: buildWorkflowSteps({
        workflowRunId: "workflow-run-1",
        attemptCount: 1,
        gatewayStatus: "failed",
        lastError: "provider rejected request",
      }),
    },
  ];

  await page.route("**/hualala.workflow.v1.WorkflowService/ListWorkflowRuns", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workflowRuns: workflowRuns.map((workflowRun) => summarizeWorkflowRun(workflowRun)),
      }),
    });
  });
  await page.route("**/hualala.workflow.v1.WorkflowService/GetWorkflowRun", async (route) => {
    const body = route.request().postDataJSON() as { workflowRunId?: string };
    const workflowRun = workflowRuns.find((record) => record.id === body.workflowRunId);
    if (!workflowRun) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "workflow run not found" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workflowRun: summarizeWorkflowRun(workflowRun),
        workflowSteps: workflowRun.steps,
      }),
    });
  });
  await page.route("**/hualala.workflow.v1.WorkflowService/RetryWorkflowRun", async (route) => {
    const body = route.request().postDataJSON() as { workflowRunId?: string };
    const current = workflowRuns.find((record) => record.id === body.workflowRunId);
    if (!current) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "workflow run not found" }),
      });
      return;
    }

    const attemptCount = current.attemptCount + 1;
    const nextWorkflowRun: MockWorkflowRun = {
      ...current,
      status: "running",
      currentStep: `attempt_${attemptCount}.gateway`,
      attemptCount,
      lastError: "",
      steps: buildWorkflowSteps({
        workflowRunId: current.id,
        attemptCount,
        gatewayStatus: "running",
        lastError: "",
      }),
    };
    workflowRuns = [
      nextWorkflowRun,
      ...workflowRuns.filter((workflowRun) => workflowRun.id !== nextWorkflowRun.id),
    ];

    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workflowRun: summarizeWorkflowRun(nextWorkflowRun),
      }),
    });
  });
  await page.route("**/hualala.workflow.v1.WorkflowService/StartWorkflow", async (route) => {
    const body = route.request().postDataJSON() as {
      workflowType?: string;
      resourceId?: string;
      projectId?: string;
    };
    const workflowRunId = `workflow-run-${workflowRuns.length + 1}`;
    const nextWorkflowRun: MockWorkflowRun = {
      id: workflowRunId,
      workflowType: body.workflowType ?? "shot_pipeline",
      status: "running",
      resourceId: body.resourceId ?? "shot-exec-live-1",
      projectId: body.projectId ?? "project-live-1",
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "",
      externalRequestId: `request-${workflowRuns.length + 1}`,
      steps: buildWorkflowSteps({
        workflowRunId,
        attemptCount: 1,
        gatewayStatus: "running",
        lastError: "",
      }),
    };
    workflowRuns = [nextWorkflowRun, ...workflowRuns];

    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workflowRun: summarizeWorkflowRun(nextWorkflowRun),
      }),
    });
  });
}
