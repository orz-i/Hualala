import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase2 preview: creator saves assembly and admin observes the same project preview", async ({ page }) => {
  await mockConnectRoutes(page, {
    preview: "success",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();

  await page.getByLabel("可选镜头").selectOption("shot-preview-2");
  await page.getByRole("button", { name: "从镜头目录追加" }).click();

  await page.getByTestId("preview-item-draft-1").getByRole("button", { name: "上移" }).click();
  await page.getByRole("button", { name: "保存预演装配" }).click();

  await expect(page.getByText("预演装配已保存")).toBeVisible();
  const firstPreviewItem = page.locator('[data-testid^="preview-item-"]').first();
  await expect(firstPreviewItem.getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(firstPreviewItem.getByText("开场 / 第二镜")).toBeVisible();
  await expect(firstPreviewItem.getByText("image · cleared · AI annotated")).toBeVisible();
  await expect(firstPreviewItem.getByText("completed · manual")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await expect(page.locator('[data-testid^="preview-item-"]').first().getByText("SCENE-001 / SHOT-002")).toBeVisible();

  await page.locator('[data-testid^="preview-item-"]').first().getByRole("button", { name: "查看来源" }).click();

  await expect(page.getByRole("dialog", { name: "素材来源详情" })).toBeVisible();
  await expect(page.getByText("asset-preview-2")).toBeVisible();
  await expect(page.getByText("来源运行 ID：run-preview-2")).toBeVisible();
  await page.getByRole("button", { name: "关闭来源详情" }).click();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await expect(page.getByText("预演条目数：2")).toBeVisible();
  await expect(page.getByText("缺少主素材的条目：1")).toBeVisible();
  await expect(page.getByText("缺失来源运行摘要的条目：1")).toBeVisible();
  await expect(page.getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(page.getByText("开场 / 第二镜")).toBeVisible();
  await expect(page.getByText("image · cleared · AI annotated")).toBeVisible();
  await expect(page.getByText("completed · manual")).toBeVisible();

  await page.getByRole("button", { name: "查看来源" }).first().click();
  const adminProvenanceDialog = page.getByRole("dialog", { name: "资源来源详情" });
  await expect(adminProvenanceDialog).toBeVisible();
  await expect(adminProvenanceDialog.getByText("asset-preview-2", { exact: true })).toBeVisible();
  await expect(adminProvenanceDialog.getByText("来源运行 ID：run-preview-2")).toBeVisible();
});
