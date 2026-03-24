import { expect, test } from "@playwright/test";
import { runBackendSeed } from "./fixtures/runBackendSeed";

test("phase2 real smoke: creator audio workbench saves and reloads timeline", async ({ page }) => {
  const seed = await runBackendSeed();
  const audioUrl = `http://127.0.0.1:4174/audio?projectId=${encodeURIComponent(seed.creatorShot.projectId)}`;

  await page.goto(audioUrl);
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: seed.creatorShot.projectId })).toBeVisible();

  const dialogueTrack = page.getByTestId("audio-track-dialogue");
  await dialogueTrack.getByLabel("从素材池选择音频").selectOption({ index: 1 });
  await dialogueTrack.getByRole("button", { name: "添加片段" }).click();
  await dialogueTrack.getByLabel("音量").fill("0");
  await page.getByRole("button", { name: "保存音频时间线" }).click();

  await expect(page.getByText("音频时间线已保存")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: seed.creatorShot.projectId })).toBeVisible();
  await expect(page.getByTestId("audio-track-dialogue").getByLabel("音量")).toHaveValue("0");
});
