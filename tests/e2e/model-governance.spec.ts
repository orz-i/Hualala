import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

const MOCK_ADMIN_URL =
  "http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1";

async function enterAdminSession(page) {
  await page.goto(MOCK_ADMIN_URL);
  await page.getByRole("button", { name: "进入开发会话" }).click();
  await expect(page.getByRole("navigation", { name: "管理端主导航" })).toBeVisible();
}

test("model governance: admin manages profiles and prompt versions without regressing org governance", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    admin: "success",
  });

  await enterAdminSession(page);
  await page.getByRole("button", { name: "治理", exact: true }).click();

  await expect(page.getByRole("heading", { name: "模型与 Prompt 治理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "角色与权限编辑" })).toBeVisible();

  const createProfileCard = page.getByTestId("model-profile-create-card");
  await createProfileCard.getByLabel("供应商").fill("openai");
  await createProfileCard.getByLabel("模型名称").fill("gpt-4.1-mini");
  await createProfileCard.getByLabel("能力类型").fill("text");
  await createProfileCard.getByLabel("输入语言").fill("zh-CN, en-US");
  await createProfileCard.getByLabel("输出语言").fill("zh-CN");
  await createProfileCard.getByRole("button", { name: "创建模型 Profile" }).click();

  await expect(page.getByText("模型 Profile 已创建")).toBeVisible();
  await expect(page.getByText("openai/gpt-4.1-mini")).toBeVisible();

  const createPromptCard = page.getByTestId("prompt-template-create-card");
  await createPromptCard.getByLabel("模板族").fill("shot.generate");
  await createPromptCard.getByLabel("模板键").fill("shot.generate.default");
  await createPromptCard.getByLabel("模板内容").fill("新增版本模板");
  await createPromptCard.getByRole("button", { name: "创建 Prompt 新版本" }).click();

  await expect(page.getByText("Prompt 新版本已创建")).toBeVisible();
  const draftPromptCard = page.getByTestId("prompt-template-card-prompt-template-2");
  await expect(draftPromptCard).toBeVisible();
  await draftPromptCard.getByRole("button", { name: "发布版本 prompt-template-2" }).click();

  await expect(page.getByText("Prompt 状态已更新")).toBeVisible();
  await expect(draftPromptCard.getByText("状态：active")).toBeVisible();

  await page.getByRole("button", { name: "暂停 profile model-profile-1" }).click();
  await expect(page.getByText("模型 Profile 状态已更新")).toBeVisible();
  await expect(page.getByRole("button", { name: "启用 profile model-profile-1" })).toBeVisible();

  await page.getByRole("button", { name: "查看上下文详情 context-bundle-1" }).click();
  const contextBundleDetail = page.getByTestId("context-bundle-detail");
  await expect(contextBundleDetail).toBeVisible();
  await expect(contextBundleDetail.getByText("project-live-1")).toBeVisible();
  await expect(contextBundleDetail.getByText("snapshot-live-1")).toBeVisible();
  await expect(
    contextBundleDetail.getByText("{\"temperature\":0.2,\"top_p\":0.9}"),
  ).toBeVisible();

  await expect(page.getByRole("heading", { name: "成员角色分配" })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建角色" })).toBeVisible();
});
