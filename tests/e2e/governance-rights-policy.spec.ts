import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("governance rights policy: governance summary and reuse audit expose the live consent matrix", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
    reuse: "success",
  });

  await page.goto("http://127.0.0.1:4174/reuse?projectId=project-live-1&shotId=shot-reuse-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await page.getByLabel("来源项目 ID").fill("project-source-9");
  await page.getByRole("button", { name: "加载外部项目素材" }).click();

  const grantedAiCard = page.getByText("asset-external-ai-granted-1", { exact: true }).locator("..");
  await expect(grantedAiCard.getByText(/同意 granted/)).toBeVisible();
  await grantedAiCard.getByRole("button", { name: "复用为当前镜头主素材" }).click();
  await expect(page.getByText("当前主素材：asset-external-ai-granted-1")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/governance?projectId=project-live-1&shotExecutionId=shot-exec-reuse-1",
  );
  await expect(page.getByText("素材复用策略摘要")).toBeVisible();
  await expect(page.getByText(/rights_status 必须为 clear/)).toBeVisible();
  await expect(page.getByText(/AI 标注素材需要 consent_status=granted/)).toBeVisible();
  await expect(page.getByText(/consent_status=not_required/)).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/reuse?projectId=project-live-1&shotExecutionId=shot-exec-reuse-1",
  );
  await expect(page.getByText("跨项目素材复用审计")).toBeVisible();
  await expect(page.getByText("复用资格：允许")).toBeVisible();
  await expect(page.getByText(/consentStatus=granted/)).toBeVisible();
  await expect(page.getByText(/aiAnnotated=true/)).toBeVisible();
  await expect(page.getByText(/consent_status=granted/)).toBeVisible();
});
