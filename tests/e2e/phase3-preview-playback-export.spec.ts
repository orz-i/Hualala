import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase3 preview playback/export: creator consumes delivery payload and admin sees the same audit", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    preview: "success",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await page.getByRole("button", { name: "请求预演渲染" }).click();

  await expect(page.getByText("渲染状态：queued")).toBeVisible();
  await expect(page.getByText("渲染状态：succeeded")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("交付模式：file")).toBeVisible();
  await expect(page.getByText("时长：31000ms")).toBeVisible();
  await expect(page.getByText("文件名：preview-export-project-live-1.mp4")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开播放输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/project-live-1/preview-runtime.mp4",
  );
  await expect(page.getByRole("link", { name: "打开导出输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/project-live-1/preview-export.mp4",
  );
  await expect(page.getByTestId("preview-runtime-video")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await expect(page.getByText("交付模式：file")).toBeVisible();
  await expect(page.getByText("文件名：preview-export-project-live-1.mp4")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开播放输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/project-live-1/preview-runtime.mp4",
  );
  await expect(page.getByRole("link", { name: "打开导出输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/project-live-1/preview-export.mp4",
  );
  await expect(page.locator("[data-testid='preview-runtime-video']")).toHaveCount(0);
});

test("phase3 preview playback/export: creator and admin both surface failed runtime errors", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    preview: "failure",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();
  await page.getByRole("button", { name: "请求预演渲染" }).click();

  await expect(page.getByText("渲染状态：queued")).toBeVisible();
  await expect(page.getByText("渲染状态：failed")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("最后错误码：preview_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的播放 / 导出输出。")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await expect(page.getByText("渲染状态：failed")).toBeVisible();
  await expect(page.getByText("最后错误码：preview_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的播放 / 导出输出。")).toBeVisible();
});
