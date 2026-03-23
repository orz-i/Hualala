# Phase 2 Contract Freeze

## 范围

这份 runbook 只定义 2026-03-23 这轮 post-foundation micro-patch 冻结的首批 shared truth，目标是先把实时协同与预演工作台的公共契约收口，再让 backend、admin、creator 在后续并行分支里消费。

当前 runbook 现在分两轮冻结：第一轮是协同 / 预演，第二轮是音频时间线 shared truth。第一轮协同 / 预演仍保持“不扩 `asset.proto`、`workflow.proto`”这条边界；第二轮音频只扩 `asset.proto`，仍不扩 `workflow.proto`。

本轮共享入口包括：

- `proto/hualala/content/v1/content.proto`
- `proto/hualala/project/v1/project_service.proto`
- `proto/hualala/asset/v1/asset.proto`
- `packages/sdk/src/connect/services/content.ts`
- `packages/sdk/src/connect/services/project.ts`
- `packages/sdk/src/sse/*`
- `infra/migrations/0015_phase2_collab_preview_shared_truth.sql`
- `infra/migrations/0016_phase2_audio_timeline_shared_truth.sql`

## 协同 Shared Truth

本轮协同只覆盖以下真相层：

- session
- presence
- lock
- draft version

协同 RPC 统一以 `owner_type + owner_id` 为资源键，返回固定 shared truth：

- session 元数据
- 当前 `draft version`
- 当前锁持有人
- `lease_expires_at`
- presence 列表
- 最近冲突摘要

本轮同时冻结首个协同 SSE 事件：

- `content.collaboration.updated`

固定 payload 只承载共享真相摘要，不承载页面局部状态：

- `session_id`
- `owner_type`
- `owner_id`
- `draft_version`
- `lock_holder_user_id`
- `lease_expires_at`
- `conflict_summary`
- `presence_count`
- `changed_user_id`
- `change_kind`

## 预演 Shared Truth

本轮预演只覆盖项目级 / 集级 preview assembly：

- preview assembly 元数据
- ordered shot refs
- selected primary asset refs
- source run refs
- assembly status

预演装配只引用现有 `shot_id`、`primary_asset_id`、`source_run_id` 和 workflow status code，不额外扩新的 asset / workflow 公共模型。

## 明确不在本轮范围内

本轮不扩 `asset.proto`、`workflow.proto`，也不扩 admin / creator 的页面状态、hook、路由或 E2E 消费层实现；协同 SSE 消费端留给后续产品线实现。

## 音频 Shared Truth

本轮新增冻结项目级 audio timeline：

- audio timeline 元数据
- track
- clip
- render_workflow_run_id / render_status

音频对象继续共享 `project_id + episode_id` scope，但不并入 preview assembly。

asset 侧只补最小共享字段：

- `media_type`
- `duration_ms`

workflow 侧只复用现有 workflow run，不新增 public API，也不在 `workflow.proto` 中新增 audio timeline RPC。

## 明确仍不在本轮范围内

以下 backlog 明确延后到下一轮 foundation patch：

- reuse

## 验证约束

后续产品分支若需要扩协同或预演共享契约，必须先回到 foundation patch 修改上述 proto、SDK client、SSE event contract、migration 和 runbook，而不是在单一产品分支里私扩 shared truth。
