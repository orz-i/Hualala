import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase2 asset reuse: creator reuses an eligible external asset and admin audits the same shot", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
    reuse: "success",
  });

  await page.goto("http://127.0.0.1:4174/reuse?projectId=project-live-1&shotId=shot-reuse-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "shot-reuse-1" })).toBeVisible();
  await expect(page.getByText("当前主素材：asset-current-1")).toBeVisible();

  await page.getByLabel("来源项目 ID").fill("project-source-9");
  await page.getByRole("button", { name: "加载外部项目素材" }).click();

  await expect(page.getByText("asset-external-1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("creator: consent status is unavailable for ai_annotated assets"),
  ).toBeVisible();

  const blockedCard = page.getByText("asset-external-ai-1", { exact: true }).locator("..");
  await expect(
    blockedCard.getByRole("button", { name: "复用为当前镜头主素材" }),
  ).toBeDisabled();

  const allowedCard = page.getByText("asset-external-1", { exact: true }).locator("..");
  await allowedCard.getByRole("button", { name: "查看来源" }).click();

  const creatorProvenanceDialog = page.getByRole("dialog", { name: "素材来源详情" });
  await expect(creatorProvenanceDialog).toBeVisible();
  await expect(creatorProvenanceDialog.getByText("asset-external-1", { exact: true })).toBeVisible();
  await expect(creatorProvenanceDialog.getByText("来源运行 ID：run-source-1")).toBeVisible();
  await page.getByRole("button", { name: "关闭来源详情" }).click();

  await allowedCard.getByRole("button", { name: "复用为当前镜头主素材" }).click();
  await expect(page.getByText("镜头主素材已更新").first()).toBeVisible();
  await expect(page.getByText("当前主素材：asset-external-1")).toBeVisible();

  await page.reload();
  await expect(page.getByText("当前主素材：asset-external-1")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/reuse?projectId=project-live-1&shotExecutionId=shot-exec-reuse-1",
  );
  await expect(page.getByText("跨项目素材复用审计")).toBeVisible();
  await expect(page.getByText("来源项目 ID：project-source-9")).toBeVisible();
  await expect(page.getByText("复用资格：允许")).toBeVisible();

  await page.getByRole("button", { name: "查看来源" }).click();
  const adminProvenanceDialog = page.getByRole("dialog", { name: "资源来源详情" });
  await expect(adminProvenanceDialog).toBeVisible();
  await expect(adminProvenanceDialog.getByText("asset-external-1", { exact: true })).toBeVisible();
  await expect(adminProvenanceDialog.getByText("来源运行 ID：run-source-1")).toBeVisible();
});
