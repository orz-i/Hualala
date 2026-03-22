import { expect, test, type Page } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";
import { mockCreatorWorkflowObservabilityRoutes } from "./fixtures/mockCreatorWorkflowObservability";

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

function buildCreatorAssetProvenancePayload(assetId: string) {
  const isSecondCandidate = assetId === "asset-live-2";

  return {
    asset: {
      id: assetId,
      projectId: "project-live-1",
      sourceType: "upload_session",
      rightsStatus: "clear",
      importBatchId: "import-batch-live-1",
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary:
      "source_type=upload_session import_batch_id=import-batch-live-1 rights_status=clear",
    candidateAssetId: isSecondCandidate ? "candidate-live-2" : "candidate-live-1",
    shotExecutionId: "shot-exec-live-1",
    sourceRunId: isSecondCandidate ? "source-run-live-2" : "source-run-live-1",
    importBatchId: "import-batch-live-1",
    variantCount: 2,
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
  await page.route(
    /\/hualala\.asset\.v1\.AssetService\/GetAssetProvenanceSummary$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildCreatorAssetProvenancePayload("asset-live-2")),
      });
    },
  );
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
  await page.route(
    /\/hualala\.asset\.v1\.AssetService\/GetAssetProvenanceSummary$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildCreatorAssetProvenancePayload("asset-live-2")),
      });
    },
  );

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
  await secondShotCandidate.getByRole("button", { name: "View provenance" }).click();
  await expect(page.getByRole("dialog", { name: "Asset provenance" })).toBeVisible();
  await expect(
    page.getByText(
      "source_type=upload_session import_batch_id=import-batch-live-1 rights_status=clear",
    ),
  ).toBeVisible();
  await expect(page.getByText("Source run ID: source-run-live-2")).toBeVisible();
  await expect(page.getByText("Variant count: 2")).toBeVisible();
  await page.getByRole("button", { name: "Close provenance" }).click();
  await expect(page.getByRole("dialog", { name: "Asset provenance" })).toHaveCount(0);
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
  await secondImportCandidate.getByRole("button", { name: "View provenance" }).click();
  await expect(page.getByRole("dialog", { name: "Asset provenance" })).toBeVisible();
  await expect(
    page.getByText(
      "source_type=upload_session import_batch_id=import-batch-live-1 rights_status=clear",
    ),
  ).toBeVisible();
  await expect(page.getByText("Source run ID: source-run-live-2")).toBeVisible();
  await expect(page.getByText("Variant count: 2")).toBeVisible();
  await page.getByRole("button", { name: "Close provenance" }).click();
  await expect(page.getByRole("dialog", { name: "Asset provenance" })).toHaveCount(0);
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
