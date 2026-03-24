# Phase 2 Preview Demo

## 范围

- creator 使用 `/preview?projectId=<id>` 作为预演装配入口。
- admin 使用 `/preview?projectId=<id>&shotExecutionId=<id>` 做只读预演观测。
- 当前真实 smoke 只覆盖 creator 侧“读取、追加、保存、再次读取”；admin 继续由 mock acceptance 覆盖。
- richer aggregation、真实播放器和字幕/转场高级能力继续留在 3B backlog。

## 本地验证

```powershell
corepack pnpm --filter @hualala/creator test
corepack pnpm --filter @hualala/admin test
corepack pnpm run build
corepack pnpm run test:e2e:phase2:preview
corepack pnpm run test:e2e:phase2:preview:real
corepack pnpm run test:e2e:phase2
corepack pnpm run test:tooling
```

## 演示流程

1. 打开 creator：`http://127.0.0.1:4174/preview?projectId=project-live-1`
2. 点击“进入开发会话”，确认页面显示当前项目 ID、状态和条目数。
3. 在“输入 shotId”中追加一个镜头，例如 `shot-preview-2`，必要时填写 `primaryAssetId / sourceRunId`。
4. 点击“保存预演装配”，确认反馈“预演装配已保存”。
5. 刷新页面，确认刚才的条目仍在，顺序没有漂移。
6. 打开 admin：`http://127.0.0.1:4173/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1`
7. 确认 admin 页面能看到相同项目的预演条目数、缺失主素材条目数和 provenance 入口。

## 失败排查

- 如果 creator `/preview` 首次打开为空白，先查 `ProjectService/GetPreviewWorkbench` 是否返回了自动创建的 assembly，而不是 `not found`。
- 如果保存后刷新条目丢失，先查 `UpsertPreviewAssembly` 是否按 sequence 重排并持久化，而不是只回显 draft item。
- 如果 provenance 按钮打开失败，先查 `AssetService/GetAssetProvenanceSummary` 是否为当前 `primaryAssetId` 返回了 `source_run_id`。
- 如果 real smoke 追加条目失败，先查 `tooling/scripts/backend_seed.mjs` 种下的 project/shot 是否与 `/preview?projectId=...` 目标一致。
