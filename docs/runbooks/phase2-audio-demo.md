# Phase 2 Audio Demo

## 范围

- creator 使用 `/audio?projectId=<id>` 作为唯一完整音频编辑面。
- creator `/preview?projectId=<id>` 只展示音频摘要卡和跳转入口。
- admin 使用 `/audio?projectId=<id>&shotExecutionId=<id>` 做只读观测。
- 从 Phase 3 audio runtime foundation patch 开始，creator `/audio` 现在已经直接消费 `AudioRuntime`：运行态区会展示真实混音输出、内联 `<audio controls>` 和 waveform 引用。
- admin `/audio` 现在已经直接消费同一份 `AudioRuntime`：运行态区只读展示 mix output / waveform audit，不嵌播放器。
- waveform 当前仍是引用级 consumer，只展示稳定 `waveform_url` 和元数据，不绘制图形波形图。
- 从 Phase 3 audio waveform document foundation patch 开始，`waveform_url` 背后的 JSON body 已冻结为 waveform document v1：`audio_waveform_v1 + duration_ms + peaks`。

## 本地验证

```powershell
corepack pnpm --filter @hualala/creator test
corepack pnpm --filter @hualala/admin test
corepack pnpm run build
corepack pnpm run test:e2e:phase3:audio-runtime
corepack pnpm run test:e2e:phase2:audio
corepack pnpm run test:e2e:phase2:audio:real
corepack pnpm run test:tooling
```

## 演示流程

1. 打开 creator：`http://127.0.0.1:4174/audio?projectId=project-live-1`
2. 进入开发会话后，在“项目内音频素材池”确认只出现音频资产。
3. 在 `dialogue` 轨选择 `dialogue.wav`，添加一个 clip，并把音量改成 `0`。
4. 点击“保存音频时间线”，确认反馈为“音频时间线已保存”。
5. 在 creator `/audio` 点击“请求渲染”，先确认 runtime 区显示 `queued`，随后刷新为 `completed`。
6. 在 creator runtime 区确认已经出现混音输出、内联播放器和至少一条 waveform 引用。
7. 打开 creator preview：`/preview?projectId=project-live-1`，确认音频摘要卡仍然出现轨道数、片段数和“打开音频工作台”入口。
8. 点击“打开音频工作台”回到 `/audio`，确认刚才保存的 clip 仍在，且 runtime 区保留最新渲染结果。
9. 打开 admin：`http://127.0.0.1:4173/audio?projectId=project-live-1&shotExecutionId=shot-exec-live-1`，确认只读态能看到同一份 runtime audit、混音输出链接和 waveform 引用，并且不嵌播放器。

## 失败排查

- 如果 creator `/audio` 为空，先检查 `AssetService/ListImportBatches` 和 `AssetService/GetImportBatchWorkbench` 是否返回 `media_type=audio` 且 `duration_ms > 0`。
- 如果 creator `/audio` 的运行态区一直停在 `idle` 或 `queued`，先检查 `ProjectService/GetAudioRuntime`、`RequestAudioRender` 和 `project.audio.runtime.updated` 是否按当前 project scope 连通；runtime consumer 只把 SSE 当 invalidation signal。
- 如果 waveform URL 打开后是 404 或返回非预期 JSON，先检查对应 worker 或 mock 是否返回了 `audio_waveform_v1`，并确认 `duration_ms > 0` 且 `peaks` 非空。
- 如果 preview 没有音频摘要，先检查 `ProjectService/GetAudioWorkbench` 是否返回空 timeline 还是错误；当前 preview 对音频摘要是 fail-closed，不会让整页白屏。
- 如果 admin 看不到 provenance，先查 `AssetService/GetAssetProvenanceSummary` 是否为对应 `assetId` 返回了 `source_run_id` 和 `import_batch_id`。
- 如果 real smoke 打开 `/audio` 后素材池为空，先检查 `tooling/scripts/backend_seed.mjs` 是否已为目标 project 注入 `audio/wav` 或 `audio/mpeg` 资产，并确认 `duration_ms > 0`。
