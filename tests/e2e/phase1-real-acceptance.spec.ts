import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

test("phase1 real acceptance: admin and creator flows are usable against backend", async ({
  browser,
}) => {
  const seed = await runBackendSeed();

  const adminPage = await browser.newPage();
  await adminPage.route(
    "**/hualala.billing.v1.BillingService/UpdateBudgetPolicy",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    },
  );
  await adminPage.goto(seed.urls.admin);
  await adminPage.getByRole("button", { name: "进入开发会话" }).click();
  await expect(adminPage.getByRole("heading", { name: "最近变更" })).toBeVisible();
  await expect(adminPage.getByText(seed.admin.projectId)).toBeVisible();
  await adminPage.close();

  const shotPage = await browser.newPage();
  await shotPage.route(
    "**/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    },
  );
  await shotPage.goto(seed.urls.creatorShot);
  await shotPage.getByRole("button", { name: "进入开发会话" }).click();
  await shotPage.getByRole("button", { name: "Gate 检查" }).click();
  await expect(shotPage.getByText("Gate 检查已完成")).toBeVisible();
  await shotPage.close();

  const importPage = await browser.newPage();
  await importPage.goto(seed.urls.creatorImport);
  await importPage.getByRole("button", { name: "进入开发会话" }).click();
  await importPage.getByRole("button", { name: "设为主素材" }).click();
  await expect(importPage.getByText("主素材选择已完成")).toBeVisible();
  await expect(importPage.getByText("当前主素材")).toBeVisible();
  await importPage.close();
});
