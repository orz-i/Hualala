# Phase 3 Preview Demo

## 范围

这份 runbook 只覆盖 Phase 3 preview 3B 产品线的直接消费面：

- creator `/preview?projectId=<id>`
- admin `/preview?projectId=<id>&shotExecutionId=<id>`
- 已冻结 contract 见 [`phase3-preview-contract-freeze.md`](./phase3-preview-contract-freeze.md)

本轮不包含独立播放器页、导出页和音频联动增强。

runtime shared truth 已冻结在 [`phase3-preview-runtime-freeze.md`](./phase3-preview-runtime-freeze.md)，播放/导出 delivery payload 与 worker callback 已冻结在 [`phase3-preview-playback-export-freeze.md`](./phase3-preview-playback-export-freeze.md)，timeline spine 已冻结在 [`phase3-preview-timeline-spine-freeze.md`](./phase3-preview-timeline-spine-freeze.md)。

## Creator 路径

1. 打开 creator 预演页：`/preview?projectId=project-live-1`
2. 进入开发会话后，页面顶部会展示：
   - 当前 assembly 状态
   - `Runtime` 面板
   - 音频摘要卡
   - `Shot Chooser`
3. 页面不会新增 preview 专属 locale picker，而是直接跟随 app 全局 locale。
   - 当全局 locale 从 `zh-CN` 切到 `en-US` 时，`scene_title / shot_title` 和 chooser 元数据会重新拉取
   - 当前未保存的条目顺序、增删结果、已选 chooser 项和手动 `shotId` 输入不会被重置
4. 通过 chooser 选择镜头后，点击 `从镜头目录追加`
5. 新条目会直接显示：
   - `scene_code / shot_code`
   - `scene_title / shot_title`
   - `primary_asset` 摘要
   - `source_run` 摘要
6. `Runtime` 面板现在会显示：
   - `status`
   - `render_status`
   - `render_workflow_run_id`
   - `resolved_locale`
   - `playback_asset_id`
   - `export_asset_id`
   - playback delivery：`delivery_mode / playback_url / poster_url / duration_ms`
   - timeline spine：ordered shot segments、`total_duration_ms`、optional transition summary
   - export delivery：`download_url / mime_type / file_name / size_bytes`
   - failed runtime 时的 `last_error_code / last_error_message`
7. 点击 `请求预演渲染` 后：
   - 当 assembly 非空且当前没有 `queued/running` render 时，请求会使用当前 app locale 作为 `requested_locale`
   - 页面会先看到 `queued` 态
   - 随后由 `project.preview.runtime.updated` 事件触发 runtime 刷新
   - runtime 区块会被动更新到最新状态，但不会清空未保存的 assembly 草稿、chooser 选中项或手动 `shotId`
   - `delivery_mode=file` 时，creator 会直接在 runtime 面板内渲染原生 `<video controls>`
   - `delivery_mode=manifest` 时，creator 不引入新播放器依赖，只展示 manifest URL 和显式“打开播放输出”动作
8. 允许继续做：
   - 上移 / 下移
   - 删除
   - 保存预演装配
   - 打开镜头工作台
   - 查看素材来源
9. 如果 chooser 暂时失败，页面仍会保留已有 assembly，并显示独立 chooser 错误；次级路径可手动输入 `shotId`
10. 如果 runtime 请求失败、render 失败或 SSE 刷新失败：
   - 错误只留在 runtime 区块
   - assembly 编辑面、metadata 展示和音频摘要不会被拖垮

## Admin 路径

1. 打开 admin 预演页：`/preview?projectId=project-live-1&shotExecutionId=shot-exec-live-1`
2. 页面会展示：
   - assembly 状态
   - 预演条目数
   - 缺失主素材的条目数
   - 缺失来源运行摘要的条目数
   - 只读 `Runtime` 摘要区
3. admin 也直接跟随 app 全局 locale；切换后只刷新 `scene_title / shot_title` 等 locale-sensitive 摘要，不改变只读审计语义。
4. 每个条目都按 metadata-first 方式展示：
   - `scene_code / shot_code`
   - `scene_title / shot_title`
   - `primary_asset` 摘要
   - `source_run` 摘要
5. admin `Runtime` 摘要区会跟 creator 使用同一份 preview runtime truth，并通过相同的 `project.preview.runtime.updated` 事件做刷新。
6. admin 只做 delivery audit：
   - 展示 playback/export delivery 摘要、timeline spine 摘要和失败信息
   - 提供“打开播放输出 / 打开导出输出”动作
   - 不嵌入原生播放器
7. admin 保持只读，只能查看 provenance，不允许改 assembly，也不提供 render 按钮

## 验证命令

本轮最低验证命令：

- `corepack pnpm --filter @hualala/creator test`
- `corepack pnpm --filter @hualala/admin test`
- `corepack pnpm run build`
- `corepack pnpm run test:tooling`
- `corepack pnpm run test:e2e:phase3:preview-timeline`
- `corepack pnpm run test:e2e:phase3:preview-runtime`
- `corepack pnpm run test:e2e:phase3:preview-playback-export`
- `corepack pnpm run test:e2e:phase2:real`

## 已知边界

- chooser 默认按 project-only scope 工作，当前 UI 不提供 `episode_id` picker
- 当前页面没有 preview 专属 locale 切换控件，只消费 app 全局 locale
- 只有 `scene / shot` 标题会跟随 locale 变化；`project_title / episode_title` 继续保持当前存储值
- 若缺少 `snapshot_kind=title` 翻译快照，后端会回退到源标题，页面不额外报错
- `UpsertPreviewAssembly` 写入 shape 不变，仍只保存 `shotId / primaryAssetId / sourceRunId / sequence`
- creator 只在 `delivery_mode=file` 时用原生内联 `<video>`；`manifest` 仍然退回显式打开动作
- admin 只展示 delivery audit，不嵌入播放器
- 后续播放器/导出 consumer 应直接消费 runtime 的 timeline spine，不再从裸 `duration_ms` 和 URL 反推结构
