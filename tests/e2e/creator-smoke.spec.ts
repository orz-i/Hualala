import { expect, test, type Page } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

async function postJson<TResponse>(
  page,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: TResponse }> {
  return page.evaluate(
    async ({ requestPath, requestBody }) => {
      const response = await fetch(requestPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      return {
        status: response.status,
        json: await response.json(),
      };
    },
    {
      requestPath: path,
      requestBody: body,
    },
  );
}

async function enterDevSession(page) {
  await page.getByRole("button", { name: "进入开发会话" }).click();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

async function mockCreatorWorkflowObservabilityRoutes(page: Page) {
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

function buildCreatorShotWorkbench({
  reviewPhase,
  primaryAssetId,
}: {
  reviewPhase: "initial" | "afterGate" | "afterSubmit";
  primaryAssetId: string;
}) {
  return {
    workbench: {
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        orgId: "org-1",
        projectId: "project-live-1",
        status: reviewPhase === "afterSubmit" ? "submitted_for_review" : "candidate_ready",
        primaryAssetId,
      },
      candidateAssets: [
        {
          id: "candidate-live-1",
          assetId: "asset-live-1",
          shotExecutionId: "shot-exec-live-1",
          sourceRunId: "source-run-live-1",
        },
        {
          id: "candidate-live-2",
          assetId: "asset-live-2",
          shotExecutionId: "shot-exec-live-1",
          sourceRunId: "source-run-live-2",
        },
      ],
      reviewSummary: {
        latestConclusion:
          reviewPhase === "afterSubmit"
            ? "approved"
            : reviewPhase === "afterGate"
              ? "passed"
              : "pending",
      },
      latestEvaluationRun: {
        id: reviewPhase === "initial" ? "eval-live-pending" : "eval-live-passed",
        status: reviewPhase === "initial" ? "pending" : "passed",
      },
    },
  };
}

async function mockCreatorCandidatePoolShotRoutes(page: Page) {
  let reviewPhase: "initial" | "afterGate" | "afterSubmit" = "initial";
  let primaryAssetId = "asset-live-1";

  await page.route("**/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks", async (route) => {
    reviewPhase = "afterGate";
    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passedChecks: ["asset_selected", "review_ready"],
        failedChecks: ["copyright_missing"],
      }),
    });
  });
  await page.route("**/hualala.execution.v1.ExecutionService/SubmitShotForReview", async (route) => {
    reviewPhase = "afterSubmit";
    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
  await page.route("**/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", async (route) => {
    const body = route.request().postDataJSON() as {
      shotExecutionId?: string;
      assetId?: string;
    };
    primaryAssetId = body.assetId ?? primaryAssetId;
    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
  await page.route("**/hualala.execution.v1.ExecutionService/GetShotWorkbench", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildCreatorShotWorkbench({
          reviewPhase,
          primaryAssetId,
        }),
      ),
    });
  });
  await page.route("**/hualala.review.v1.ReviewService/ListEvaluationRuns", async (route) => {
    const evaluationRuns =
      reviewPhase === "initial"
        ? [
            {
              id: "eval-live-pending",
              status: "pending",
              passedChecks: [],
              failedChecks: [],
            },
          ]
        : [
            {
              id: "eval-live-pending",
              status: "pending",
              passedChecks: [],
              failedChecks: [],
            },
            {
              id: "eval-live-passed",
              status: "passed",
              passedChecks: ["asset_selected", "review_ready"],
              failedChecks: ["copyright_missing"],
            },
          ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ evaluationRuns }),
    });
  });
  await page.route("**/hualala.review.v1.ReviewService/ListShotReviews", async (route) => {
    const shotReviews =
      reviewPhase === "afterSubmit"
        ? [
            {
              id: "review-live-passed",
              conclusion: "passed",
              commentLocale: "en-US",
            },
            {
              id: "review-live-approved",
              conclusion: "approved",
              commentLocale: "en-US",
            },
          ]
        : reviewPhase === "afterGate"
          ? [
              {
                id: "review-live-passed",
                conclusion: "passed",
                commentLocale: "en-US",
              },
            ]
          : [
              {
                id: "review-live-pending",
                conclusion: "pending",
                commentLocale: "en-US",
              },
            ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ shotReviews }),
    });
  });
}

async function mockCreatorCandidatePoolImportRoutes(page: Page) {
  let phase: "initial" | "afterConfirm" | "afterSelect" = "initial";
  const requests = {
    confirmedItemIds: [] as string[],
    selectedPrimaryAssetId: "",
  };

  const buildImportWorkbench = () => ({
    importBatch: {
      id: "batch-live-1",
      status: phase === "initial" ? "matched_pending_confirm" : "confirmed",
      sourceType: "upload_session",
    },
    uploadSessions: [
      {
        id: "upload-session-live-1",
        status: "completed",
      },
    ],
    items: [
      {
        id: "item-live-1",
        status: phase === "initial" ? "matched_pending_confirm" : "confirmed",
        assetId: "asset-live-1",
      },
      {
        id: "item-live-2",
        status: phase === "initial" ? "matched_pending_confirm" : "confirmed",
        assetId: "asset-live-2",
      },
    ],
    candidateAssets: [
      {
        id: "candidate-live-1",
        assetId: "asset-live-1",
        shotExecutionId: "shot-exec-live-1",
        sourceRunId: "source-run-live-1",
      },
      {
        id: "candidate-live-2",
        assetId: "asset-live-2",
        shotExecutionId: "shot-exec-live-1",
        sourceRunId: "source-run-live-2",
      },
    ],
    shotExecutions: [
      {
        id: "shot-exec-live-1",
        status: phase === "initial" ? "candidate_ready" : "primary_selected",
        primaryAssetId: phase === "afterSelect" ? "asset-live-2" : "",
      },
    ],
  });

  await page.route("**/hualala.asset.v1.AssetService/GetImportBatchWorkbench", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildImportWorkbench()),
    });
  });
  await page.route(
    "**/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
    async (route) => {
      const body = route.request().postDataJSON() as {
        itemIds?: string[];
      };
      requests.confirmedItemIds = [...(body.itemIds ?? [])];
      phase = "afterConfirm";
      await delay(120);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    },
  );
  await page.route("**/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", async (route) => {
    const body = route.request().postDataJSON() as {
      assetId?: string;
    };
    requests.selectedPrimaryAssetId = body.assetId ?? "";
    phase = "afterSelect";
    await delay(120);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  return requests;
}

test("creator smoke: shot workbench actions complete with refreshed feedback", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorShot: "success",
  });
  await mockCreatorCandidatePoolShotRoutes(page);
  await mockCreatorWorkflowObservabilityRoutes(page);

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await enterDevSession(page);

  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
  await expect(page.getByText("2 个候选素材")).toBeVisible();
  await expect(page.getByText("最近一次运行：workflow-run-1")).toBeVisible();
  await expect(page.getByText("当前步骤：attempt_1.gateway")).toBeVisible();
  await expect(page.getByText("尝试次数：1")).toBeVisible();
  await expect(page.getByText("最近错误：provider rejected request")).toBeVisible();
  await expect(page.getByText("步骤：attempt_1.dispatch", { exact: true })).toBeVisible();
  await expect(page.getByText("步骤：attempt_1.gateway", { exact: true })).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Review Outcome" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflow Steps" })).toBeVisible();
  await expect(page.getByText("Current step: attempt_1.gateway")).toBeVisible();
  await expect(page.getByText("Attempt count: 1")).toBeVisible();
  await expect(page.getByText("Last error: provider rejected request")).toBeVisible();
  await expect(page.getByText("Source run: source-run-live-2")).toBeVisible();
  const secondShotCandidate = page
    .locator("article")
    .filter({ hasText: "Candidate: candidate-live-2" })
    .first();
  await secondShotCandidate.getByRole("button", { name: "Set as primary asset" }).click();
  await expect(page.getByText("Shot primary asset updated")).toBeVisible();
  await expect(page.getByText("Primary asset: asset-live-2")).toBeVisible();
  await expect(page.getByText("review-live-pending")).toBeVisible();
  await page.getByRole("button", { name: "Retry Workflow" }).click();
  await expect(page.getByText("Retrying workflow")).toBeVisible();
  await expect(page.getByText("Workflow retried")).toBeVisible();
  await expect(page.getByText("Current status: running")).toBeVisible();
  await expect(page.getByText("Current step: attempt_2.gateway")).toBeVisible();
  await expect(page.getByText("Attempt count: 2")).toBeVisible();
  await expect(page.getByText("Last error: none")).toBeVisible();
  await expect(page.getByText("Step: attempt_2.dispatch", { exact: true })).toBeVisible();
  await expect(page.getByText("Step: attempt_2.gateway", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start Workflow" }).click();
  await expect(page.getByText("Starting workflow")).toBeVisible();
  await expect(page.getByText("Workflow started")).toBeVisible();
  await expect(page.getByText("Latest run: workflow-run-2")).toBeVisible();
  await expect(page.getByText("Current step: attempt_1.gateway")).toBeVisible();
  await expect(page.getByText("Attempt count: 1")).toBeVisible();
  await expect(page.getByText("External request ID: request-2")).toBeVisible();
  await expect(page.getByText("Step: attempt_1.dispatch", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("ui-locale-select")).toHaveValue("en-US");
  await expect(page.getByRole("button", { name: "Run Gate Checks" })).toBeVisible();

  await page.getByRole("button", { name: "Run Gate Checks" }).click();
  await expect(page.getByText("Running gate checks")).toBeVisible();
  await expect(page.getByText("Gate checks completed")).toBeVisible();
  await expect(page.getByText("Passed checks", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed checks", { exact: true })).toBeVisible();
  await expect(page.getByText("Latest review outcome：passed").first()).toBeVisible();
  await expect(page.getByText("Latest evaluation：passed").first()).toBeVisible();
  await expect(page.getByText("eval-live-passed")).toBeVisible();
  await expect(page.getByText("Passed checks: asset_selected, review_ready")).toBeVisible();
  await expect(page.getByText("review-live-passed")).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review")).toBeVisible();
  await expect(page.getByText("submitted_for_review")).toBeVisible();
  await expect(page.getByText("review-live-approved")).toBeVisible();
  await expect(page.getByText("Conclusion: approved")).toBeVisible();
});

test("creator smoke: shot workbench keeps content on action failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    creatorShot: "failure",
  });

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await enterDevSession(page);

  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
  await page.getByRole("button", { name: "Gate 检查" }).click();
  await expect(page.getByText("Gate 检查失败")).toBeVisible();
  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
});

test("creator smoke: import workbench actions complete with refreshed feedback", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorImport: "success",
  });
  const importRequests = await mockCreatorCandidatePoolImportRoutes(page);

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
  await expect(page.getByText("1 个上传会话")).toBeVisible();
  await expect(page.getByText("2 个批次条目")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认匹配" })).toBeDisabled();

  await page.getByLabel("选择条目 item-live-2").check();
  await expect(page.getByText("已选 1 条")).toBeVisible();

  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("正在确认匹配")).toBeVisible();
  await expect(page.getByText("匹配确认已完成")).toBeVisible();
  await expect(page.getByText("当前批次状态：confirmed")).toBeVisible();
  await expect(page.getByText("当前执行状态：primary_selected")).toBeVisible();
  expect(importRequests.confirmedItemIds).toEqual(["item-live-2"]);
  await expect(page.getByText("已选 0 条")).toBeVisible();

  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Candidate Pool" })).toBeVisible();
  await expect(page.getByText("Source run: source-run-live-2")).toBeVisible();

  const secondImportCandidate = page
    .locator("article")
    .filter({ hasText: "Candidate: candidate-live-2" })
    .first();
  await secondImportCandidate
    .getByRole("button", { name: "Set as primary asset" })
    .click();
  await expect(page.getByText("Primary asset selected")).toBeVisible();
  expect(importRequests.selectedPrimaryAssetId).toBe("asset-live-2");
  await expect(page.getByText("Primary asset: asset-live-2")).toBeVisible();
});

test("creator smoke: import workbench keeps content on action failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    creatorImport: "failure",
  });

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("匹配确认失败")).toBeVisible();
  await expect(page.getByText("batch-live-1")).toBeVisible();
});

test("creator smoke: missing workflow retries return not found from mock routes", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorShot: "success",
  });

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");

  const missingRetry = await postJson<{ error: string }>(
    page,
    "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun",
    {
      workflowRunId: "workflow-run-missing",
    },
  );

  expect(missingRetry.status).toBe(404);
  expect(missingRetry.json.error).toBe("workflow run not found");
});
