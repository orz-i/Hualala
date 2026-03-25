import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

const MOCK_ADMIN_URL =
  "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1";

async function enterAdminSession(page) {
  await page.goto(MOCK_ADMIN_URL);
  await page.getByRole("button", { name: "进入开发会话" }).click();
  await expect(page.getByRole("navigation", { name: "管理端主导航" })).toBeVisible();
}

test("backup restore: creates, downloads, preflights, and applies a backup package", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await enterAdminSession(page);
  await page.getByRole("button", { name: "备份恢复", exact: true }).click();

  await expect(page.getByRole("heading", { name: "运行时备份与恢复" })).toBeVisible();
  await expect(page.getByText("还没有备份包，先生成一个新的备份。")).toBeVisible();

  await page.getByRole("button", { name: "生成备份" }).click();
  await expect(page.getByText("备份包已生成。")).toBeVisible();
  await expect(page.getByText("已选择备份包 pkg-backup-001")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("hualala-backup-pkg-backup-001.json");

  await page.getByRole("button", { name: "恢复前校验" }).click();
  await expect(page.getByText("恢复前校验已完成。")).toBeVisible();
  await expect(page.getByText("恢复会覆盖当前运行时数据。")).toBeVisible();
  await expect(page.getByText("transient gateway_results 缓存会被清空。")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "执行恢复" }).click();
  await expect(page.getByText("运行时恢复已完成。")).toBeVisible();
});
