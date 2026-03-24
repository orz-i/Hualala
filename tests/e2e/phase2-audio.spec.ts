import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase2 audio: creator edits timeline, preview summarizes it, and admin observes the same project", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    audio: "success",
  });

  await page.goto("http://127.0.0.1:4174/audio?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();

  const dialogueTrack = page.getByTestId("audio-track-dialogue");
  await dialogueTrack.getByLabel("从素材池选择音频").selectOption({ label: "dialogue.wav" });
  await dialogueTrack.getByRole("button", { name: "添加片段" }).click();
  await expect(dialogueTrack.getByText("asset-audio-dialogue-1")).toBeVisible();

  await dialogueTrack.getByLabel("音量").fill("0");
  await dialogueTrack.getByLabel("开始时间 ms").fill("200");
  await dialogueTrack.getByRole("button", { name: "查看来源" }).click();

  const creatorProvenanceDialog = page.getByRole("dialog", { name: "素材来源详情" });
  await expect(creatorProvenanceDialog).toBeVisible();
  await expect(creatorProvenanceDialog.getByText("asset-audio-dialogue-1", { exact: true })).toBeVisible();
  await expect(creatorProvenanceDialog.getByText("来源运行 ID：run-audio-dialogue-1")).toBeVisible();
  await page.getByRole("button", { name: "关闭来源详情" }).click();

  await page.getByRole("button", { name: "保存音频时间线" }).click();
  await expect(page.getByText("音频时间线已保存")).toBeVisible();
  await expect(dialogueTrack.getByLabel("音量")).toHaveValue("0");

  await page.reload();
  await expect(page.getByTestId("audio-track-dialogue")).toBeVisible();
  await expect(page.getByTestId("audio-track-dialogue").getByLabel("音量")).toHaveValue("0");
  await expect(page.getByTestId("audio-track-dialogue").getByText("asset-audio-dialogue-1")).toBeVisible();

  await page.goto("http://127.0.0.1:4174/preview?projectId=project-live-1");
  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await expect(page.getByText("音频轨道数：3")).toBeVisible();
  await expect(page.getByText("音频片段数：1")).toBeVisible();
  await page.getByRole("button", { name: "打开音频工作台" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4174/audio?projectId=project-live-1");
  await expect(page.getByTestId("audio-track-dialogue").getByText("asset-audio-dialogue-1")).toBeVisible();

  await page.goto(
    "http://127.0.0.1:4173/audio?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );
  await expect(page.getByRole("heading", { name: "多轨音频态势" })).toBeVisible();
  await expect(page.getByText("音轨数：3")).toBeVisible();
  await expect(page.getByText("音频片段数：1")).toBeVisible();

  await page.getByRole("button", { name: "查看来源" }).first().click();
  const adminProvenanceDialog = page.getByRole("dialog", { name: "资源来源详情" });
  await expect(adminProvenanceDialog).toBeVisible();
  await expect(adminProvenanceDialog.getByText("asset-audio-dialogue-1", { exact: true })).toBeVisible();
  await expect(adminProvenanceDialog.getByText("来源运行 ID：run-audio-dialogue-1")).toBeVisible();
});
