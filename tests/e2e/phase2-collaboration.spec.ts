import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase2 collaboration: creator renews lease and admin observes the same session state", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    collaboration: "success",
  });

  await page.goto("http://127.0.0.1:4174/collab?projectId=project-live-1&shotId=shot-collab-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "shot-collab-1" })).toBeVisible();
  await expect(page.getByText("当前锁持有人：user-reviewer-7")).toBeVisible();
  await expect(page.getByText("当前在线成员 2 人")).toBeVisible();

  await page.getByLabel("续租 draftVersion").fill("11");
  await page.getByRole("button", { name: "续租并声明编辑" }).click();

  await expect(page.getByText("协同租约已续期")).toBeVisible();
  await expect(page.getByText("当前锁持有人：user-live-1")).toBeVisible();
  await expect(page.getByText("当前 draftVersion：11")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/collaboration?projectId=project-live-1&shotExecutionId=shot-exec-live-1&shotId=shot-collab-1",
  );

  await expect(page.getByRole("heading", { name: "协同态势" })).toBeVisible();
  await expect(page.getByText("当前锁持有人：user-live-1")).toBeVisible();
  await expect(page.getByText("当前 draftVersion：11")).toBeVisible();
  await expect(page.getByText("当前在线成员 2 人")).toBeVisible();
});
