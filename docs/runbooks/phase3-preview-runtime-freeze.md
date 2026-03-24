# Phase 3 Preview Runtime Freeze

## 范围

这份 runbook 只冻结 Phase 3 preview runtime foundation patch 的共享契约。

本轮 owner 固定为：

- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/projectapp/*preview*`
- `apps/backend/internal/platform/events/events.go`
- `infra/migrations/0017_phase3_preview_runtime_shared_truth.sql`

本轮不包含 creator/admin UI、播放器、导出页、字幕/转场 richer payload 或音频联动。

## Runtime Shared Truth

本轮 preview runtime 只经 `ProjectService` 暴露，不拆新的 preview service：

- `GetPreviewRuntime`
- `RequestPreviewRender`

冻结的 `PreviewRuntime` 字段为：

- `preview_runtime_id`
- `project_id`
- `episode_id`
- `assembly_id`
- `status`
- `render_workflow_run_id`
- `render_status`
- `playback_asset_id`
- `export_asset_id`
- `resolved_locale`
- `created_at`
- `updated_at`

其中：

- scope 继续沿用 preview 既有 scope，支持 `project-only` 和 `project_id + episode_id`
- `playback_asset_id` / `export_asset_id` 只表示最终输出素材引用，不承载 URL、manifest 或 richer payload
- `resolved_locale` 只表示本次 render 请求实际使用的 locale

## Render 规则

- `GetPreviewRuntime` 首次读取自动建空 runtime，而不是返回 `not found`
- `RequestPreviewRender` 继续复用通用 workflow run，固定 `workflow_type=preview.render_assembly`
- assembly 为空时返回 `failed precondition`
- 同一 scope 已有 `queued` 或 `running` render 时，重复触发返回 `failed precondition`
- 请求成功后，runtime 进入：
  - `status=queued`
  - `render_status=queued`
  - `render_workflow_run_id=<workflow_run_id>`

## Preview SSE

本轮只冻结一条 preview 共享事件：

- `project.preview.runtime.updated`

payload 只允许包含最小 runtime 摘要：

- `project_id`
- `episode_id`
- `preview_runtime_id`
- `render_status`
- `render_workflow_run_id`
- `resolved_locale`
- `playback_asset_id`
- `export_asset_id`
- `occurred_at`

后续 worker / callback 只能消费这条 runtime truth，不应在产品分支私扩别的 preview runtime 事件 shape。

## 明确不在本轮范围内

- preview 播放器 UI
- 导出执行页面
- 字幕 / 转场 / manifest payload
- 多轨音频联动
- preview runtime callback 新 contract
