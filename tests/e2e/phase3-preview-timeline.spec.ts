import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase3 preview timeline: creator and admin both consume timeline spine audit", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    preview: "success",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await page.getByRole("button", { name: "请求预演渲染" }).click();

  await expect(page.getByText("渲染状态：completed")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("段落数：2")).toBeVisible();
  await expect(page.getByText("总时长：31000ms")).toBeVisible();
  await expect(page.getByText("镜头：SHOT-001 / 第一镜")).toBeVisible();
  await expect(page.getByText("起始：0ms")).toBeVisible();
  await expect(page.getByText("播放素材：asset-preview-playback-project-live-1-segment-1")).toBeVisible();
  await expect(page.getByText("来源运行：run-preview-1")).toBeVisible();
  await expect(page.getByText("转场：crossfade · 300ms")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await expect(page.getByText("段落数：2")).toBeVisible();
  await expect(page.getByText("总时长：31000ms")).toBeVisible();
  await expect(page.getByText("镜头：SHOT-001 / 第一镜")).toBeVisible();
  await expect(page.getByText("播放素材：asset-preview-playback-project-live-1-segment-1")).toBeVisible();
  await expect(page.getByText("来源运行：run-preview-1")).toBeVisible();
  await expect(page.locator("[data-testid='preview-runtime-video']")).toHaveCount(0);
});

test("phase3 preview timeline: failed runtime does not render fake timeline", async ({ page }) => {
  await mockConnectRoutes(page, {
    preview: "failure",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();
  await page.getByRole("button", { name: "请求预演渲染" }).click();

  await expect(page.getByText("渲染状态：failed")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("最后错误码：preview_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的播放 / 导出输出。")).toBeVisible();
  await expect(page.getByText("当前播放输出还没有 timeline spine")).toHaveCount(0);

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await expect(page.getByText("渲染状态：failed")).toBeVisible();
  await expect(page.getByText("最后错误码：preview_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的播放 / 导出输出。")).toBeVisible();
  await expect(page.getByText("当前播放输出还没有 timeline spine")).toHaveCount(0);
});
