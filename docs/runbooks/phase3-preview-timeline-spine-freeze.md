# Phase 3 Preview Timeline Spine Freeze

## 范围

这份 runbook 只冻结 Phase 3 preview timeline spine foundation patch 的共享契约。

本轮 owner 固定为：

- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/projectapp/*preview*`
- `apps/backend/internal/platform/db/*preview_runtime*`
- `apps/backend/internal/platform/events/events.go`
- `infra/migrations/0019_phase3_preview_timeline_spine.sql`

本轮不包含 creator/admin UI、真实播放器页、导出页、字幕、波形、音轨引用或多轨联动。

## Timeline Spine Shared Truth

runtime richer payload 的唯一新增范围是 `playback.timeline`。

冻结的 `PreviewTimelineSpine` 字段为：

- `segments`
- `total_duration_ms`

冻结的 `PreviewTimelineSegment` 字段为：

- `segment_id`
- `sequence`
- `shot_id`
- `shot_code`
- `shot_title`
- `playback_asset_id`
- `source_run_id`
- `start_ms`
- `duration_ms`
- `transition_to_next`

冻结的 `PreviewTransition` 字段为：

- `transition_type`
- `duration_ms`

v1 只覆盖 ordered shot segments 和 optional transition summary，不包含字幕、波形、音轨、多轨联动或 manifest 内部结构。

## Worker Callback 规则

`playback.timeline` 是 worker-owned truth：

- 只能通过 `ApplyPreviewRenderUpdate` 写回
- `GetPreviewRuntime` 负责读回

当 `render_status=completed` 且存在 `playback.timeline` 时，必须满足：

- `segments` 至少 1 条
- `sequence` 从 1 连续递增
- `start_ms + duration_ms` 形成非重叠、按序增长的 timeline
- `total_duration_ms` 等于最后一段的 `start_ms + duration_ms`
- 每个 segment 的 `shot_id` 非空
- 每个 segment 的 `duration_ms` 大于 0

`transition_to_next` 是可选字段：

- 为空时允许
- 若存在，`transition_type` 必须非空，`duration_ms` 必须大于 0

## Request 清空规则

`RequestPreviewRender` 成功排队时，和现有 playback/export/error 一样，必须清空旧的：

- `playback.timeline`
- `playback_asset_id`
- `export_asset_id`
- `last_error_code`
- `last_error_message`

这样后续 consumer 不会继续读到 stale timeline spine。

## SSE 边界

本轮不扩 `project.preview.runtime.updated` 的 payload。

SSE 仍只做 invalidation signal，不直接携带 timeline spine。

后续播放器/导出 consumer 继续靠 refetch 读取完整 runtime。

## 明确不在本轮范围

- 字幕 cue
- 音轨引用
- 波形数组
- 镜头内关键帧
- manifest segment 列表
- 更细粒度的转场视觉参数
