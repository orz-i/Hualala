# Phase 3 Preview Title Localization Freeze

## 范围

这份 runbook 只冻结 2026-03-24 这轮 Phase 3 foundation patch 的 title localization shared truth。

本轮目标是：

- 复用既有 `content_snapshots`
- 把 `snapshot_kind=title` 固定成 scene / shot 标题翻译的唯一共享真相
- 让 `ContentService` 和 `ProjectService` 的 `display_locale` 真正影响 scene / shot 标题读取

本轮 owner 固定为：

- `proto/hualala/content/v1/content.proto`
- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/content.ts`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/contentapp/*`
- `apps/backend/internal/application/projectapp/*preview*`

## Shared Truth

### Snapshot Kind

`content_snapshots` 现在显式暴露 `snapshot_kind`，并只冻结两种值：

- `content`
- `title`

规则：

- `snapshot_kind=title` 只允许 `owner_type=scene|shot`
- `body` 固定解释为纯文本标题
- 不引入 JSON payload，也不承载字幕 / 转场 / narration 数据

### Content Read Locale

既有这些 RPC 的 `display_locale` 现在是有效读 hint：

- `ListScenes`
- `GetScene`
- `ListSceneShots`
- `GetShot`

行为固定为：

- 若命中同 locale 的 `snapshot_kind=title`，返回 localized `title`
- 若缺失翻译，fail-closed 回退到当前存储标题
- `source_locale` 继续表示原始源语言，不改语义

### Preview Locale

`ProjectService` 重新暴露：

- `GetPreviewWorkbenchRequest.display_locale`
- `ListPreviewShotOptionsRequest.display_locale`

`display_locale` 只影响：

- `PreviewShotSummary.scene_title`
- `PreviewShotSummary.shot_title`

明确不影响：

- `project_title`
- `episode_title`

这两个字段继续返回当前存储值，不进入这轮 localization shared truth。

## Precondition / Fail-Closed

- 非 `scene|shot` owner 使用 `snapshot_kind=title`：`invalid argument`
- `CreateLocalizedSnapshot(snapshot_kind=title)` 若 source snapshot kind 不匹配：`failed precondition`
- 旧 preview scope 语义不变：
  - `project not found`
  - `episode not found`
  - `failed precondition`
- 缺失 title 翻译不报错，只回退到存储标题

## 明确不在本轮范围内

本轮不包含：

- project / episode title localization
- preview UI locale 切换控件
- preview SSE
- 播放器 / 导出执行
- richer preview payload
- 音频联动

这些都属于后续产品线或新的 foundation patch，不能在产品分支里顺手私扩。
