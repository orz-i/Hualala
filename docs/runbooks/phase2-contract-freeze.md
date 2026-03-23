# Phase 2 Contract Freeze

## 范围

这份 runbook 只定义 2026-03-23 这轮 post-foundation micro-patch 冻结的首批 shared truth，目标是先把实时协同与预演工作台的公共契约收口，再让 backend、admin、creator 在后续并行分支里消费。

本轮只冻结以下两组共享入口：

- `proto/hualala/content/v1/content.proto`
- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/content.ts`
- `packages/sdk/src/connect/services/project.ts`
- `infra/migrations/0015_phase2_collab_preview_shared_truth.sql`

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

## 预演 Shared Truth

本轮预演只覆盖项目级 / 集级 preview assembly：

- preview assembly 元数据
- ordered shot refs
- selected primary asset refs
- source run refs
- assembly status

预演装配只引用现有 `shot_id`、`primary_asset_id`、`source_run_id` 和 workflow status code，不额外扩新的 asset / workflow 公共模型。

## 明确不在本轮范围内

本轮不扩 `asset.proto`、`workflow.proto`，也不扩 admin / creator 的页面状态、hook、路由或 E2E 消费层实现。

以下 backlog 明确延后到下一轮 foundation patch：

- audio
- reuse

## 验证约束

后续产品分支若需要扩协同或预演共享契约，必须先回到 foundation patch 修改上述 proto、SDK client、migration 和 runbook，而不是在单一产品分支里私扩 shared truth。
