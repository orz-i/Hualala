import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase1 acceptance: admin and creator flows are usable", async ({ browser }) => {
  const adminPage = await browser.newPage();
  await mockConnectRoutes(adminPage, {
    admin: "success",
  });
  await adminPage.goto(
    "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1",
  );
  await adminPage.getByRole("button", { name: "进入开发会话" }).click();
  await expect(adminPage.getByRole("heading", { name: "最近变更" })).toBeVisible();
  await adminPage.close();

  const shotPage = await browser.newPage();
  await mockConnectRoutes(shotPage, {
    creatorShot: "success",
  });
  await shotPage.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await shotPage.getByRole("button", { name: "进入开发会话" }).click();
  await shotPage.getByRole("button", { name: "Gate 检查" }).click();
  await expect(shotPage.getByText("Gate 检查已完成")).toBeVisible();
  await shotPage.close();

  const importPage = await browser.newPage();
  await mockConnectRoutes(importPage, {
    creatorImport: "success",
  });
  await importPage.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await importPage.getByRole("button", { name: "进入开发会话" }).click();
  await importPage.getByRole("button", { name: "设为主素材" }).click();
  await expect(importPage.getByText("主素材选择已完成")).toBeVisible();
});
