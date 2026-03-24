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
  await page.getByRole("textbox").fill("shot-manual-9");

  await page.getByTestId("preview-item-draft-1").getByRole("button", { name: "上移" }).click();
  await page.getByTestId("ui-locale-select").selectOption("en-US");

  const firstPreviewItem = page.locator('[data-testid^="preview-item-"]').first();

  await expect(page.getByRole("textbox")).toHaveValue("shot-manual-9");
  await expect(page.getByText("Opening / Second Shot")).toHaveCount(2);
  await expect(firstPreviewItem.getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(firstPreviewItem.getByText("Opening / Second Shot")).toBeVisible();
  await expect(firstPreviewItem.getByText("image · cleared · AI annotated")).toBeVisible();
  await expect(firstPreviewItem.getByText("completed · manual")).toBeVisible();

  await page.getByRole("button", { name: "Save Preview Assembly" }).click();

  await expect(page.getByText("Preview assembly saved")).toBeVisible();
  await expect(firstPreviewItem.getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(firstPreviewItem.getByText("Opening / Second Shot")).toBeVisible();
  await expect(firstPreviewItem.getByText("image · cleared · AI annotated")).toBeVisible();
  await expect(firstPreviewItem.getByText("completed · manual")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await expect(page.getByTestId("ui-locale-select")).toHaveValue("en-US");
  await expect(page.locator('[data-testid^="preview-item-"]').first().getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(page.locator('[data-testid^="preview-item-"]').first().getByText("Opening / Second Shot")).toBeVisible();

  await page.locator('[data-testid^="preview-item-"]').first().getByRole("button", { name: "View provenance" }).click();

  await expect(page.getByRole("dialog", { name: "Asset provenance" })).toBeVisible();
  await expect(page.getByText("asset-preview-2")).toBeVisible();
  await expect(page.getByText("Source run ID: run-preview-2")).toBeVisible();
  await page.getByRole("button", { name: "Close provenance" }).click();

  await page.goto(
    "http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "项目预演态势" })).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByText("Preview items: 2")).toBeVisible();
  await expect(page.getByText("Items missing a primary asset: 1")).toBeVisible();
  await expect(page.getByText("Items missing source run summary: 1")).toBeVisible();
  await expect(page.getByText("SCENE-001 / SHOT-002")).toBeVisible();
  await expect(page.getByText("Opening / Second Shot")).toBeVisible();
  await expect(page.getByText("image · cleared · AI annotated")).toBeVisible();
  await expect(page.getByText("completed · manual")).toBeVisible();

  await page.getByRole("button", { name: "View provenance" }).first().click();
  const adminProvenanceDialog = page.getByRole("dialog", { name: "Asset Provenance Details" });
  await expect(adminProvenanceDialog).toBeVisible();
  await expect(adminProvenanceDialog.getByText("asset-preview-2", { exact: true })).toBeVisible();
  await expect(adminProvenanceDialog.getByText("Source run ID: run-preview-2")).toBeVisible();
});
