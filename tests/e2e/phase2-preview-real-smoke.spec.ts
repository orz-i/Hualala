import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

test("phase2 real smoke: creator preview workbench saves and reloads assembly", async ({ page }) => {
  const seed = await runBackendSeed();
  const previewUrl = `http://127.0.0.1:4174/preview?projectId=${encodeURIComponent(seed.creatorShot.projectId)}`;

  await page.goto(previewUrl);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: seed.creatorShot.projectId })).toBeVisible();

  await page.getByPlaceholder("输入 shotId，例如 shot-live-1").fill(seed.creatorShot.shotId);
  await page.getByPlaceholder("可选，输入 sourceRunId").fill("real-preview-run-1");
  await page.getByRole("button", { name: "追加预演条目" }).click();
  await page.getByRole("button", { name: "保存预演装配" }).click();

  await expect(page.getByText("预演装配已保存")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: seed.creatorShot.projectId })).toBeVisible();
  const previewItems = page.locator('[data-testid^="preview-item-"]');
  await expect(previewItems).toHaveCount(1);
  await expect(previewItems.first().locator("input").first()).toHaveValue(seed.creatorShot.shotId);
});
