# Phase 2 Asset Reuse Demo

## 范围

- creator 使用 `/reuse?projectId=<id>&shotId=<id>` 作为跨项目素材复用入口。
- admin 使用 `/reuse?projectId=<id>&shotExecutionId=<id>` 做只读审计与 provenance 排障。
- 当前版本只做“引用现有外部项目素材”，不做复制落地、不做批量搬运、不新增 shared truth。
- 复用资格继续依赖现有素材来源与授权语义；rights / consent 缺失时默认 fail closed。

## 本地验证

```powershell
corepack pnpm --filter @hualala/creator test
corepack pnpm --filter @hualala/admin test
corepack pnpm run build
corepack pnpm run test:e2e:phase2:asset-reuse
corepack pnpm run test:e2e:phase2
corepack pnpm run test:tooling
```

## 演示流程

1. 打开 creator：`http://127.0.0.1:4174/reuse?projectId=project-live-1&shotId=shot-reuse-1`
2. 点击“进入开发会话”，确认页面显示当前镜头 `shot-reuse-1` 和当前主素材 `asset-current-1`。
3. 在“来源项目 ID”输入 `project-source-9`，点击“加载外部项目素材”。
4. 确认列表里出现：
   - 可复用素材 `asset-external-1`
   - 被阻断素材 `asset-external-ai-1`
5. 点击 `asset-external-1` 的“查看来源”，确认来源详情中能看到 `来源运行 ID：run-source-1`。
6. 确认 `asset-external-ai-1` 的“复用为当前镜头主素材”按钮是禁用态，并显示 blocked reason。
7. 点击 `asset-external-1` 的“复用为当前镜头主素材”，确认页面反馈“镜头主素材已更新”，当前主素材切换为 `asset-external-1`。
8. 刷新 creator 页面，确认当前主素材仍是 `asset-external-1`。
9. 打开 admin：`http://127.0.0.1:4173/reuse?projectId=project-live-1&shotExecutionId=shot-exec-reuse-1`
10. 确认 admin 页面显示：
    - `来源项目 ID：project-source-9`
    - `复用资格：允许`
    - provenance 按钮可打开并显示同一条 `run-source-1`

## 失败排查

- 如果 creator 输入来源项目后列表为空，先检查 `AssetService/ListImportBatches` 是否按 `sourceProjectId` 返回了外部项目批次，而不是目标项目批次。
- 如果 creator 页面直接白屏或 route 级失败，先查 `ExecutionService/GetShotWorkbench` 是否返回了完整 `workbench` 包装，而不是裸 `shotWorkbench` 对象。
- 如果素材列表能看到，但应用后刷新又回退，先查 `ExecutionService/SelectPrimaryAsset` 是否真的命中了 reuse state，而不是被其他 mock 分支覆盖。
- 如果 admin 看不到 provenance，先查 `AssetService/GetAssetProvenanceSummary` 是否对当前 `primaryAssetId` 返回了 `source_run_id`、`import_batch_id` 和来源项目。
