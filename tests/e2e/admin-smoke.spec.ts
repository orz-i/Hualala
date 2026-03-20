import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("admin smoke: renders overview and updates budget", async ({ page }) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await page.goto(
    "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1",
  );

  await expect(page.getByText("project-live-1")).toBeVisible();
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

test("admin smoke: keeps overview visible on budget update failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    admin: "failure",
  });

  await page.goto(
    "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1",
  );

  await expect(page.getByText("project-live-1")).toBeVisible();
  await page.getByLabel("预算上限（元）").fill("1500");
  await page.getByRole("button", { name: "更新预算" }).click();

  await expect(page.getByText("预算策略更新失败")).toBeVisible();
  await expect(page.getByText("project-live-1")).toBeVisible();
});
