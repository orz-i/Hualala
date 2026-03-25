import { expect, test } from "@playwright/test";
import { mockConnectRoutes } from "./fixtures/mockConnectRoutes";

test("phase3 audio runtime: creator consumes mix output and admin sees the same runtime audit", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    audio: "success",
  });

  await page.goto("http://127.0.0.1:4174/audio?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  await expect(page.getByRole("heading", { name: "project-live-1" })).toBeVisible();
  await expect(page.getByText("渲染状态：idle")).toBeVisible();

  const dialogueTrack = page.getByTestId("audio-track-dialogue");
  await dialogueTrack.getByLabel("从素材池选择音频").selectOption({ label: "dialogue.wav" });
  await dialogueTrack.getByRole("button", { name: "添加片段" }).click();
  await page.getByRole("button", { name: "保存音频时间线" }).click();
  await expect(page.getByText("音频时间线已保存")).toBeVisible();

  await page.getByRole("button", { name: "请求渲染" }).click();
  await expect(page.getByText("渲染状态：queued")).toBeVisible();
  await expect(page.getByText("渲染状态：completed")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("交付模式：file")).toBeVisible();
  await expect(page.getByText("文件名：mix-project-live-1.mp3")).toBeVisible();
  await expect(page.getByText("素材 ID：asset-audio-dialogue-1")).toBeVisible();
  await expect(page.getByTestId("audio-runtime-player")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开混音输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/audio/project-live-1/mix-download.mp3",
  );
  await expect(page.getByRole("link", { name: "打开 waveform" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/audio/project-live-1/asset-audio-dialogue-1-waveform.json",
  );

  await page.goto(
    "http://127.0.0.1:4173/audio?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "多轨音频态势" })).toBeVisible();
  await expect(page.getByText("音频运行态势")).toBeVisible();
  await expect(page.getByText("渲染状态：completed")).toBeVisible();
  await expect(page.getByText("文件名：mix-project-live-1.mp3")).toBeVisible();
  await expect(page.getByText("素材 ID：asset-audio-dialogue-1")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开混音输出" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/audio/project-live-1/mix-download.mp3",
  );
  await expect(page.getByRole("link", { name: "打开 waveform" })).toHaveAttribute(
    "href",
    "https://cdn.example.com/audio/project-live-1/asset-audio-dialogue-1-waveform.json",
  );
  await expect(page.locator("[data-testid='audio-runtime-player']")).toHaveCount(0);
});

test("phase3 audio runtime: creator and admin both surface failed runtime errors", async ({
  page,
}) => {
  await mockConnectRoutes(page, {
    audio: "failure",
  });

  await page.goto("http://127.0.0.1:4174/audio?projectId=project-live-1");
  await page.getByRole("button", { name: "进入开发会话" }).click();

  const dialogueTrack = page.getByTestId("audio-track-dialogue");
  await dialogueTrack.getByLabel("从素材池选择音频").selectOption({ label: "dialogue.wav" });
  await dialogueTrack.getByRole("button", { name: "添加片段" }).click();
  await page.getByRole("button", { name: "保存音频时间线" }).click();
  await expect(page.getByText("音频时间线已保存")).toBeVisible();

  await page.getByRole("button", { name: "请求渲染" }).click();
  await expect(page.getByText("渲染状态：queued")).toBeVisible();
  await expect(page.getByText("渲染状态：failed")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("最后错误码：audio_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的混音输出。")).toBeVisible();
  await expect(page.locator("[data-testid='audio-runtime-player']")).toHaveCount(0);

  await page.goto(
    "http://127.0.0.1:4173/audio?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
  );

  await expect(page.getByRole("heading", { name: "多轨音频态势" })).toBeVisible();
  await expect(page.getByText("渲染状态：failed")).toBeVisible();
  await expect(page.getByText("最后错误码：audio_render_failed")).toBeVisible();
  await expect(page.getByText("最后错误信息：worker callback timeout")).toBeVisible();
  await expect(page.getByText("当前还没有可消费的混音输出。")).toBeVisible();
  await expect(page.locator("[data-testid='audio-runtime-player']")).toHaveCount(0);
});
