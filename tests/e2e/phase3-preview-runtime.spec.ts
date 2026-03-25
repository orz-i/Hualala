import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase3 preview runtime: creator requests render and admin observes the same runtime", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    preview: "success",
  });

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await expect(page.getByText("渲染状态：idle")).toBeVisible();

  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByText("Resolved locale: none")).toBeVisible();

  await page.getByRole("button", { name: "Request Preview Render" }).click();

  await expect(page.getByText("Render status: queued")).toBeVisible();
  await expect(page.getByText("Render workflow: workflow-preview-1")).toBeVisible();
  await expect(page.getByText("Resolved locale: en-US")).toBeVisible();
  await expect(page.getByText("A preview render is already queued or running.")).toBeVisible();

  await expect(page.getByText("Render status: completed")).toBeVisible({ timeout: 5000 });
  await expect(
    page.getByText("Playback asset ID: asset-preview-playback-project-live-1"),
  ).toBeVisible();
  await expect(
    page.getByText("Export asset ID: asset-preview-export-project-live-1"),
  ).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByText("Preview Runtime")).toBeVisible();
  await expect(page.getByText("Render status: completed")).toBeVisible();
  await expect(page.getByText("Resolved locale: en-US")).toBeVisible();
  await expect(
    page.getByText("Playback asset ID: asset-preview-playback-project-live-1"),
  ).toBeVisible();
  await expect(
    page.getByText("Export asset ID: asset-preview-export-project-live-1"),
  ).toBeVisible();
});
