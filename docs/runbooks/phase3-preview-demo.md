# Phase 3 Preview Demo

## 范围

这份 runbook 只覆盖 Phase 3 preview 3B 产品线的直接消费面：

- creator `/preview?projectId=<id>`
- admin `/preview?projectId=<id>&shotExecutionId=<id>`
- 已冻结 contract 见 [`phase3-preview-contract-freeze.md`](./phase3-preview-contract-freeze.md)

本轮不包含播放器、preview SSE、导出执行和音频联动增强。

## Creator 路径

1. 打开 creator 预演页：`/preview?projectId=project-live-1`
2. 进入开发会话后，页面顶部会展示：
   - 当前 assembly 状态
   - 音频摘要卡
   - `Shot Chooser`
3. 通过 chooser 选择镜头后，点击 `从镜头目录追加`
4. 新条目会直接显示：
   - `scene_code / shot_code`
   - `scene_title / shot_title`
   - `primary_asset` 摘要
   - `source_run` 摘要
5. 允许继续做：
   - 上移 / 下移
   - 删除
   - 保存预演装配
   - 打开镜头工作台
   - 查看素材来源
6. 如果 chooser 暂时失败，页面仍会保留已有 assembly，并显示独立 chooser 错误；次级路径可手动输入 `shotId`

## Admin 路径

1. 打开 admin 预演页：`/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1`
2. 页面会展示：
   - assembly 状态
   - 预演条目数
   - 缺失主素材的条目数
   - 缺失来源运行摘要的条目数
3. 每个条目都按 metadata-first 方式展示：
   - `scene_code / shot_code`
   - `scene_title / shot_title`
   - `primary_asset` 摘要
   - `source_run` 摘要
4. admin 保持只读，只能查看 provenance，不允许改 assembly

## 验证命令

本轮最低验证命令：

- `corepack pnpm --filter @hualala/creator test`
- `corepack pnpm --filter @hualala/admin test`
- `corepack pnpm run build`
- `corepack pnpm run test:tooling`
- `corepack pnpm run test:e2e:phase2:preview`

## 已知边界

- chooser 默认按 project-only scope 工作，当前 UI 不提供 `episode_id` picker
- 当前页面还没有显式 locale 切换控件；但如果调用链传入 `display_locale` 且存在 `snapshot_kind=title`，scene / shot 标题会返回 localized title
- `UpsertPreviewAssembly` 写入 shape 不变，仍只保存 `shotId / primaryAssetId / sourceRunId / sequence`
