# Phase 3 Preview Contract Freeze

## 范围

这份 runbook 只定义 2026-03-24 这轮 Phase 3 preview foundation patch 冻结的共享契约。

本轮目标是把 preview 从“纯 ID 装配”升级成“可返回 metadata 摘要 + chooser 目录”的稳定 contract，为后续 3B 产品线提供清晰消费面。

本轮 owner 固定为：

- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/projectapp/*preview*`

## 共享入口

本轮 preview 只扩 `ProjectService`，不拆新的 preview service：

- `GetPreviewWorkbench`
- `ListPreviewShotOptions`
- `UpsertPreviewAssembly`

其中：

- `PreviewAssemblyItem` 在保留 `shot_id / primary_asset_id / source_run_id / sequence` 的同时，新增只读摘要：
  - `shot`
  - `primary_asset`
  - `source_run`
- `ListPreviewShotOptions` 只承载 chooser 目录，不承载页面局部状态
- `ListPreviewShotOptions` 同时支持 `project_id + episode_id` 和 project-only scope

## 摘要 Shared Truth

本轮冻结以下最小读侧真相：

- `PreviewShotSummary`
  - `project_id`
  - `project_title`
  - `episode_id`
  - `episode_title`
  - `scene_id`
  - `scene_code`
  - `scene_title`
  - `shot_id`
  - `shot_code`
  - `shot_title`
- `PreviewAssetSummary`
  - `asset_id`
  - `media_type`
  - `rights_status`
  - `ai_annotated`
- `PreviewRunSummary`
  - `run_id`
  - `status`
  - `trigger_type`

chooser 目录固定返回：

- `shot`
- `shot_execution_id`
- `shot_execution_status`
- `current_primary_asset`
- `latest_run`

## Locale 规则

本轮不冻结 `display_locale`。原因是当前 repo 里还没有 scene / shot 标题的多语言持久化真相，把 locale hint 暴露进 preview contract 只会形成 no-op wire shape。

因此当前行为固定为：

- scene / shot 标题暂时仍返回当前存储标题
- project / episode 标题继续返回当前存储值

后续如果要让 preview metadata 真正按 locale 切换标题，必须先补新的 title localization shared truth foundation patch，而不是在产品分支里私扩 fallback 逻辑。

## Fail-Closed 规则

- `shot_id / primary_asset_id / source_run_id` 始终原样返回
- 若 `primary_asset_id` 对应资产缺失，`primary_asset` 为空
- 若 `source_run_id` 对应 run 缺失，`source_run` 为空
- 若项目 / 集 scope 不合法，继续返回既有 preview 语义：
  - `project not found`
  - `episode not found`
  - `failed precondition`

## 明确不在本轮范围内

本轮不包含：

- preview SSE
- 实时播放器
- 导出执行 payload
- 字幕 / 转场 richer payload
- 多轨音频联动
- creator / admin chooser UI 或 richer preview 页面

这些都属于后续 Phase 3 产品线，不应在当前 foundation patch 或产品分支里顺手扩散 shared truth。
