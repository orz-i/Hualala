# Phase 3 Preview Playback / Export Freeze

## 范围

这份 runbook 只冻结 Phase 3 preview playback/export foundation patch 的共享契约。

本轮 owner 固定为：

- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/projectapp/*preview*`
- `apps/backend/internal/platform/events/events.go`
- `apps/backend/internal/platform/db/*preview_runtime*`
- `infra/migrations/0018_phase3_preview_runtime_outputs.sql`

本轮不包含 creator/admin UI、真实播放器页、导出页、字幕/转场 richer payload 或多轨音频联动。

## Runtime Output Shared Truth

本轮继续沿用 `ProjectService`，不拆新的 preview service：

- `GetPreviewRuntime`
- `RequestPreviewRender`
- `ApplyPreviewRenderUpdate`

冻结的 `PreviewRuntime` 新增字段为：

- `playback`
- `export_output`
- `last_error_code`
- `last_error_message`

其中：

- `playback_asset_id` / `export_asset_id` 继续是 canonical asset ref
- `playback` / `export_output` 只补 delivery metadata，不改 asset ref 语义
- `last_error_code` / `last_error_message` 只表示最近一次 render/update 的失败结果

## Delivery Payload

冻结的 `PreviewPlaybackDelivery` 字段为：

- `delivery_mode`
- `playback_url`
- `poster_url`
- `duration_ms`

冻结的 `PreviewExportDelivery` 字段为：

- `download_url`
- `mime_type`
- `file_name`
- `size_bytes`

约束：

- `delivery_mode` 只允许 `file` 和 `manifest`
- 若 `delivery_mode=manifest`，`playback_url` 就是 manifest URL
- `playback.timeline` 的 timeline spine richer payload 已冻结到 [`phase3-preview-timeline-spine-freeze.md`](./phase3-preview-timeline-spine-freeze.md)
- 本轮仍不冻结字幕轨、波形、音轨引用或其他更细 richer payload

## Worker Callback 规则

worker 只能通过 `ApplyPreviewRenderUpdate` 回写 runtime：

- `render_status=running`
  - 只更新状态与 `resolved_locale`
  - 不要求 playback/export output
- `render_status=completed`
  - 至少要有一类输出
  - 有 `playback` 时必须同时提供 `playback_asset_id`
  - 有 `export_output` 时必须同时提供 `export_asset_id`
- `render_status=failed`
  - `error_code` 或 `error_message` 至少其一

所有 update 都必须同时满足：

- `preview_runtime_id` 精确命中当前 runtime
- `render_workflow_run_id` 精确命中当前 runtime 的 active run

旧 run 不允许覆盖新一轮 queued/runtime 状态。

## Runtime 状态映射

- `running` -> runtime `status=running`
- `completed` -> runtime `status=ready`
- `failed` -> runtime `status=failed`

`RequestPreviewRender` 成功排队时必须清空旧的：

- `playback`
- `export_output`
- `last_error_code`
- `last_error_message`

## Preview SSE

这轮不新开事件类型，仍只使用：

- `project.preview.runtime.updated`

这条事件继续只是 runtime invalidation signal。

payload 仍只允许最小 runtime 摘要：

- `project_id`
- `episode_id`
- `preview_runtime_id`
- `render_status`
- `render_workflow_run_id`
- `resolved_locale`
- `playback_asset_id`
- `export_asset_id`
- `occurred_at`

后续播放器/导出 consumer 继续靠 refetch 读取完整 runtime，不要在产品分支里把 delivery payload 直接塞进 SSE。

## 明确不在本轮范围内

- creator/admin 播放器 UI
- 导出执行页或下载动作
- 直接可播 URL 的前端消费面
- 字幕轨、波形、音轨引用和更细 timeline 结构
- 多轨音频联动
