import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

test("creator real smoke: shot workbench completes gate checks against backend", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.route(
    "**/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    },
  );

  await page.goto(seed.urls.creatorShot);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByText(seed.creatorShot.shotExecutionId)).toBeVisible();
  await expect(page.getByText("1 个候选素材")).toBeVisible();

  await page.getByRole("button", { name: "Gate 检查" }).click();
  await expect(page.getByText("正在执行 Gate 检查")).toBeVisible();
  await expect(page.getByText("Gate 检查已完成")).toBeVisible();
  await expect(page.getByText("通过检查", { exact: true })).toBeVisible();
  await expect(page.getByText(/最新评审结论：/).first()).toBeVisible();
  await expect(page.getByText(/最近评估：/).first()).toBeVisible();

  await page.getByRole("button", { name: "提交评审" }).click();
  await expect(page.getByText("提交评审已完成")).toBeVisible();
  await expect(page.getByText("submitted_for_review")).toBeVisible();
});

test("creator real smoke: import workbench confirms matches and selects primary asset", async ({
  page,
}) => {
  const seed = await runBackendSeed();

  await page.route(
    "**/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    },
  );

  await page.goto(seed.urls.creatorImport);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByText(seed.creatorImport.importBatchId)).toBeVisible();
  await expect(page.getByText("1 个上传会话")).toBeVisible();

  await page.getByRole("button", { name: "确认匹配" }).click();
  await expect(page.getByText("正在确认匹配")).toBeVisible();
  await expect(page.getByText("匹配确认已完成")).toBeVisible();
  await expect(page.getByText("当前批次状态")).toBeVisible();

  await page.getByRole("button", { name: "设为主素材" }).click();
  await expect(page.getByText("主素材选择已完成")).toBeVisible();
  await expect(page.getByText("当前主素材")).toBeVisible();
});
