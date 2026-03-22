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

async function mockCreatorReviewTimelineRoutes(page: Page) {
  let phase: "initial" | "afterGate" | "afterSubmit" = "initial";

  await page.route("**/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks", async (route) => {
    phase = "afterGate";
    await route.fallback();
  });
  await page.route("**/hualala.execution.v1.ExecutionService/SubmitShotForReview", async (route) => {
    phase = "afterSubmit";
    await route.fallback();
  });
  await page.route("**/hualala.review.v1.ReviewService/ListEvaluationRuns", async (route) => {
    const evaluationRuns =
      phase === "initial"
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
      phase === "afterSubmit"
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
        : phase === "afterGate"
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

test("creator smoke: shot workbench actions complete with refreshed feedback", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorShot: "success",
  });
  await mockCreatorReviewTimelineRoutes(page);

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await enterDevSession(page);

  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
  await expect(page.getByText("1 个候选素材")).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Review Outcome" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review Timeline" })).toBeVisible();
  await expect(page.getByText("review-live-pending")).toBeVisible();
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

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
  await expect(page.getByText("1 个上传会话")).toBeVisible();

  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("正在确认匹配")).toBeVisible();
  await expect(page.getByText("匹配确认已完成")).toBeVisible();
  await expect(page.getByText("当前批次状态：confirmed")).toBeVisible();
  await expect(page.getByText("当前执行状态：primary_selected")).toBeVisible();

  await page.getByRole("button", { name: "设为主素材" }).click();
  await expect(page.getByText("主素材选择已完成")).toBeVisible();
  await expect(page.getByText("当前主素材：asset-live-1")).toBeVisible();
});

test("creator smoke: import workbench keeps content on action failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    creatorImport: "failure",
  });

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
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
