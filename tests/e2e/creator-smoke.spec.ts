import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

async function enterDevSession(page) {
  await page.getByRole("button", { name: "进入开发会话" }).click();
}

test("creator smoke: shot workbench actions complete with refreshed feedback", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorShot: "success",
  });

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await enterDevSession(page);

  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
  await expect(page.getByText("1 个候选素材")).toBeVisible();
  await page.getByTestId("ui-locale-select").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Review Outcome" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("ui-locale-select")).toHaveValue("en-US");
  await expect(page.getByRole("button", { name: "Run Gate Checks" })).toBeVisible();

  await page.getByRole("button", { name: "Run Gate Checks" }).click();
  await expect(page.getByText("Running gate checks")).toBeVisible();
  await expect(page.getByText("Gate checks completed")).toBeVisible();
  await expect(page.getByText("Passed checks", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed checks", { exact: true })).toBeVisible();
  await expect(page.getByText("Latest review outcome：passed").first()).toBeVisible();
  await expect(page.getByText("Latest evaluation：passed").first()).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review")).toBeVisible();
  await expect(page.getByText("submitted_for_review")).toBeVisible();
});

test("creator smoke: shot workbench keeps content on action failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    creatorShot: "failure",
  });

  await page.goto("http://127.0.0.1:4174/?shotId=shot-live-1");
  await enterDevSession(page);

  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
  await page.getByRole("button", { name: "Gate 检查" }).click();
  await expect(page.getByText("Gate 检查失败")).toBeVisible();
  await expect(page.getByText("shot-exec-live-1")).toBeVisible();
});

test("creator smoke: import workbench actions complete with refreshed feedback", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    creatorImport: "success",
  });

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
  await expect(page.getByText("1 个上传会话")).toBeVisible();

  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("正在确认匹配")).toBeVisible();
  await expect(page.getByText("匹配确认已完成")).toBeVisible();
  await expect(page.getByText("当前批次状态：confirmed")).toBeVisible();
  await expect(page.getByText("当前执行状态：primary_selected")).toBeVisible();

  await page.getByRole("button", { name: "设为主素材" }).click();
  await expect(page.getByText("主素材选择已完成")).toBeVisible();
  await expect(page.getByText("当前主素材：asset-live-1")).toBeVisible();
});

test("creator smoke: import workbench keeps content on action failure", async ({ page }) => {
  await mockConnectRoutes(page, {
    creatorImport: "failure",
  });

  await page.goto("http://127.0.0.1:4174/?importBatchId=batch-live-1");
  await enterDevSession(page);

  await expect(page.getByText("batch-live-1")).toBeVisible();
  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("匹配确认失败")).toBeVisible();
  await expect(page.getByText("batch-live-1")).toBeVisible();
});
