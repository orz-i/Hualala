import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

const MOCK_ADMIN_URL =
  "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1";

async function enterAdminSession(page) {
  await page.goto(MOCK_ADMIN_URL);
  await page.getByRole("button", { name: "进入开发会话" }).click();
  await expect(page.getByRole("navigation", { name: "管理端主导航" })).toBeVisible();
}

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

test("admin smoke: renders overview and updates budget", async ({ page }) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });
  await page.route("**/hualala.billing.v1.BillingService/UpdateBudgetPolicy", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fallback();
  });

  await enterAdminSession(page);

  await expect(
    page.getByRole("complementary").getByRole("heading", { name: "project-live-1" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近变更" })).toBeVisible();
  await expect(page.getByText("最近计费事件")).toBeVisible();
  await expect(page.getByText("最近评估结果")).toBeVisible();
  await expect(page.getByText("最近评审结论")).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Recent Changes" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("ui-locale-select")).toHaveValue("en-US");
  await expect(page.getByRole("heading", { name: "Recent Changes" })).toBeVisible();

  await page.getByLabel("Budget limit (yuan)").fill("1500");
  await page.getByRole("button", { name: "Update budget" }).click();

  await expect(page.getByText("Updating budget policy")).toBeVisible();
  await expect(page.getByText("Budget policy updated")).toBeVisible();
  await expect(page.getByText("Budget limit: 1500.00 元")).toBeVisible();
});

test("admin smoke: keeps overview visible on budget update failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    admin: "failure",
  });

  await enterAdminSession(page);

  await expect(
    page.getByRole("complementary").getByRole("heading", { name: "project-live-1" }),
  ).toBeVisible();
  await page.getByLabel("预算上限（元）").fill("1500");
  await page.getByRole("button", { name: "更新预算" }).click();

  await expect(page.getByText("预算策略更新失败")).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("heading", { name: "project-live-1" }),
  ).toBeVisible();
});

test("admin smoke: manages custom roles and permission edits", async ({ page }) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await enterAdminSession(page);
  await page.getByRole("button", { name: "治理" }).click();

  await expect(page.getByRole("heading", { name: "角色与权限编辑" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "角色使用中，禁止删除" })).toBeDisabled();

  const createRoleSection = page.getByRole("heading", { name: "新建角色" }).locator("..");
  await createRoleSection.getByLabel("角色代码").fill("producer");
  await createRoleSection.getByLabel("角色名称").fill("Producer");
  await createRoleSection.getByLabel("Manage roles and permissions (org.roles.write)").check();
  await createRoleSection.getByRole("button", { name: "创建角色" }).click();

  await expect(page.getByText("角色已创建")).toBeVisible();
  const producerNameInput = page.getByLabel("编辑角色 producer 的名称");
  await expect(producerNameInput).toBeVisible();
  const producerCard = producerNameInput.locator("xpath=ancestor::article[1]");

  await producerNameInput.fill("Line Producer");
  await producerCard.getByLabel("Read organization roles (org.roles.read)").check();
  await producerCard.getByRole("button", { name: "保存角色" }).click();

  await expect(page.getByText("角色已更新")).toBeVisible();
  await expect(producerNameInput).toHaveValue("Line Producer");

  await producerCard.getByRole("button", { name: "删除角色" }).click();
  await expect(page.getByText("角色已删除")).toBeVisible();
  await expect(page.getByLabel("编辑角色 producer 的名称")).toHaveCount(0);
});

test("admin smoke: mock workflow and asset routes handle edge cases consistently", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await page.goto(MOCK_ADMIN_URL);

  const workflowDetail = await postJson<{
    workflowSteps: Array<{
      completedAt?: { seconds: string; nanos: number };
      failedAt?: { seconds: string; nanos: number };
    }>;
  }>(page, "/hualala.workflow.v1.WorkflowService/GetWorkflowRun", {
    workflowRunId: "workflow-run-1",
  });
  expect(workflowDetail.status).toBe(200);
  expect(workflowDetail.json.workflowSteps[1]).not.toHaveProperty("completedAt");
  expect(workflowDetail.json.workflowSteps[1]?.failedAt?.seconds).toBeTruthy();

  const missingRetry = await postJson<{ error: string }>(
    page,
    "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun",
    {
      workflowRunId: "workflow-run-missing",
    },
  );
  expect(missingRetry.status).toBe(404);
  expect(missingRetry.json.error).toBe("workflow run not found");

  const missingCancel = await postJson<{ error: string }>(
    page,
    "/hualala.workflow.v1.WorkflowService/CancelWorkflowRun",
    {
      workflowRunId: "workflow-run-missing",
    },
  );
  expect(missingCancel.status).toBe(404);
  expect(missingCancel.json.error).toBe("workflow run not found");

  const missingAsset = await postJson<{ error: string }>(
    page,
    "/hualala.asset.v1.AssetService/GetAssetProvenanceSummary",
    {
      assetId: "",
    },
  );
  expect(missingAsset.status).toBe(404);
  expect(missingAsset.json.error).toBe("asset not found");

  const unknownAsset = await postJson<{
    asset: { id: string };
    candidateAssetId: string;
  }>(page, "/hualala.asset.v1.AssetService/GetAssetProvenanceSummary", {
    assetId: "asset-missing",
  });
  expect(unknownAsset.status).toBe(200);
  expect(unknownAsset.json.asset.id).toBe("asset-missing");
  expect(unknownAsset.json.candidateAssetId).toBe("");
});

test("admin smoke: retries a failed workflow run from the workflow monitor", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await enterAdminSession(page);
  await page.getByRole("button", { name: "工作流" }).click();

  await expect(page.getByRole("heading", { name: "工作流监控" }).first()).toBeVisible();
  await page.getByRole("button", { name: "查看工作流详情 workflow-run-1" }).click();
  await expect(page).toHaveURL(/workflowRunId=workflow-run-1/);
  await expect(page.getByRole("dialog", { name: "工作流详情" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "工作流详情" })).toBeVisible();

  await page.getByRole("button", { name: "重试工作流" }).click();
  await expect(page.getByText("工作流已重试")).toBeVisible();
});

test("admin smoke: confirms asset matches and selects a primary asset from asset monitor", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await enterAdminSession(page);
  await page.getByRole("button", { name: "资产" }).click();

  await expect(page.getByRole("heading", { name: "资产监控" }).first()).toBeVisible();
  await page.getByRole("button", { name: /查看导入批次详情/ }).click();
  await expect(page).toHaveURL(/importBatchId=batch-live-1/);
  await expect(page.getByRole("dialog", { name: "导入批次详情" })).toBeVisible();

  await page.getByRole("button", { name: /查看资源来源/ }).first().click();
  await expect(page).toHaveURL(/assetId=asset-live-1/);
  await expect(page.getByRole("dialog", { name: "资源来源详情" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "资源来源详情" })).toBeVisible();
  await page.getByRole("button", { name: "关闭资源来源详情" }).click();
  await expect(page).not.toHaveURL(/assetId=/);

  await page.getByRole("checkbox", { name: /选择导入条目/ }).click();
  await page.getByRole("button", { name: "确认已选项" }).click();
  await expect(page.getByText("正在确认已选匹配")).toBeVisible();
  await expect(page.getByText("已确认所选匹配")).toBeVisible();

  await page.getByRole("button", { name: /设置候选资源 .* 为主素材/ }).click();
  await expect(page.getByText("正在设置主素材")).toBeVisible();
  await expect(page.getByText("主素材已更新")).toBeVisible();
});
