import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

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
