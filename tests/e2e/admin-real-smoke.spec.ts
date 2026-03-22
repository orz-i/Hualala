import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

function buildAdminUrl(input: {
  projectId: string;
  shotExecutionId: string;
  orgId: string;
}) {
  const url = new URL("http://127.0.0.1:4173");
  url.searchParams.set("projectId", input.projectId);
  url.searchParams.set("shotExecutionId", input.shotExecutionId);
  url.searchParams.set("orgId", input.orgId);
  return url.toString();
}

test("admin real smoke: loads overview through vite proxy and updates budget", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.route("**/hualala.billing.v1.BillingService/UpdateBudgetPolicy", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });

  await page.goto(seed.urls.admin);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByText(seed.admin.projectId)).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近变更" })).toBeVisible();
  await expect(page.getByText("最近计费事件")).toBeVisible();
  await expect(page.getByText("最近评估结果")).toBeVisible();
  await expect(page.getByText("最近评审结论")).toBeVisible();

  await page.getByLabel("预算上限（元）").fill("1500");
  await page.getByRole("button", { name: "更新预算" }).click();

  await expect(page.getByText("正在更新预算策略")).toBeVisible();
  await expect(page.getByText("预算策略已更新")).toBeVisible();
  await expect(page.getByText("预算上限：1500.00 元")).toBeVisible();
});

test("admin real smoke: manages roles and permission edits through the real backend", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.goto(seed.urls.admin);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByText("角色与权限编辑")).toBeVisible();
  await expect(page.getByRole("button", { name: "角色使用中，禁止删除" })).toBeDisabled();

  const createRoleSection = page.getByRole("heading", { name: "新建角色" }).locator("..");
  await createRoleSection.getByLabel("角色代码").fill("producer");
  await createRoleSection.getByLabel("角色名称").fill("Producer");
  await createRoleSection.getByLabel("Manage roles and permissions (org.roles.write)").check();
  await createRoleSection.getByLabel("Read organization roles (org.roles.read)").check();
  await createRoleSection.getByRole("button", { name: "创建角色" }).click();

  await expect(page.getByText("角色已创建")).toBeVisible();
  const producerNameInput = page.getByLabel("编辑角色 producer 的名称");
  await expect(producerNameInput).toBeVisible();
  const producerCard = producerNameInput.locator("xpath=ancestor::article[1]");

  await producerNameInput.fill("Line Producer");
  await producerCard.getByLabel("Read organization members (org.members.read)").check();
  await producerCard.getByRole("button", { name: "保存角色" }).click();

  await expect(page.getByText("角色已更新")).toBeVisible();
  await expect(producerNameInput).toHaveValue("Line Producer");

  await producerCard.getByRole("button", { name: "删除角色" }).click();
  await expect(page.getByText("角色已删除")).toBeVisible();
  await expect(page.getByLabel("编辑角色 producer 的名称")).toHaveCount(0);
});

test("admin real smoke: opens asset monitor details and completes asset actions through the real backend", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.route(
    "**/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    },
  );
  await page.route("**/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });

  await page.goto(
    buildAdminUrl({
      projectId: seed.creatorImport.projectId,
      shotExecutionId: seed.creatorImport.shotExecutionId,
      orgId: seed.admin.orgId,
    }),
  );
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByText("资产监控")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`查看导入批次详情 ${seed.creatorImport.importBatchId}`) }).click();
  await expect(page.getByRole("dialog", { name: "导入批次详情" })).toBeVisible();

  await page.getByRole("button", { name: /查看资源来源/ }).first().click();
  await expect(page.getByRole("dialog", { name: "资源来源详情" })).toBeVisible();
  await page.getByRole("button", { name: "关闭资源来源详情" }).click();

  await page.getByRole("checkbox", { name: /选择导入条目/ }).click();
  await page.getByRole("button", { name: "确认已选项" }).click();
  await expect(page.getByText("正在确认已选匹配")).toBeVisible();
  await expect(page.getByText("已确认所选匹配")).toBeVisible();

  await page.getByRole("button", { name: /设置候选资源 .* 为主素材/ }).click();
  await expect(page.getByText("正在设置主素材")).toBeVisible();
  await expect(page.getByText("主素材已更新")).toBeVisible();
});

test("admin real smoke: creates and cancels a workflow run through the real backend", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.route("**/hualala.workflow.v1.WorkflowService/CancelWorkflowRun", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });

  await page.goto(seed.urls.admin);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  const startWorkflowResponse = await page.request.post(
    "http://127.0.0.1:4173/hualala.workflow.v1.WorkflowService/StartWorkflow",
    {
      data: {
        organizationId: seed.admin.orgId,
        projectId: seed.admin.projectId,
        workflowType: "asset.import",
        resourceId: seed.creatorImport.importBatchId,
      },
    },
  );
  expect(startWorkflowResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByText("工作流监控")).toBeVisible();
  await page.getByRole("button", { name: /查看工作流详情/ }).click();
  await expect(page.getByRole("dialog", { name: "工作流详情" })).toBeVisible();

  await page.getByRole("button", { name: "取消工作流" }).click();
  await expect(page.getByText("正在取消工作流")).toBeVisible();
  await expect(page.getByText("工作流已取消")).toBeVisible();
});
