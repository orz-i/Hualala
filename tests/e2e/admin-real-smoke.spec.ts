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
