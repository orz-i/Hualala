# Phase 3 Audio Runtime Waveform Freeze

## 范围

这份 runbook 只冻结 Phase 3 audio runtime foundation patch 的共享契约。

本轮 owner 固定为：

- `proto/hualala/project/v1/project_service.proto`
- `packages/sdk/src/connect/services/project.ts`
- `apps/backend/internal/application/projectapp/*audio*`
- `apps/backend/internal/platform/db/*audio_runtime*`
- `apps/backend/internal/platform/events/events.go`
- `infra/migrations/0020_phase3_audio_runtime_waveform_shared_truth.sql`

本轮不包含 creator/admin UI、音频播放器、波形消费页、导出交互或 preview 线改动。

## Runtime Shared Truth

本轮 audio runtime 只经 `ProjectService` 暴露，不拆新的 audio service：

- `GetAudioRuntime`
- `RequestAudioRender`
- `ApplyAudioRenderUpdate`

冻结的 `AudioRuntime` 字段为：

- `audio_runtime_id`
- `project_id`
- `episode_id`
- `audio_timeline_id`
- `status`
- `render_workflow_run_id`
- `render_status`
- `mix_asset_id`
- `mix_output`
- `waveforms`
- `last_error_code`
- `last_error_message`
- `created_at`
- `updated_at`

其中：

- scope 继续沿用 audio workbench 既有 scope，支持 `project-only` 和 `project_id + episode_id`
- `mix_asset_id` 继续是最终混音输出素材引用
- `waveforms` 只表达稳定的 waveform 引用集合，不替代 canonical mix asset

## Mix Delivery

冻结的 `AudioMixDelivery` 字段为：

- `delivery_mode`
- `playback_url`
- `download_url`
- `mime_type`
- `file_name`
- `size_bytes`
- `duration_ms`

本轮只冻结 delivery metadata，不冻结播放器 manifest 或下载代理语义。

## Waveform Protocol

冻结的 `AudioWaveformReference` 字段为：

- `asset_id`
- `variant_id`
- `waveform_url`
- `mime_type`
- `duration_ms`

规则固定为：

- waveform 先冻结为引用协议，不在 proto 里塞采样数组
- consumer 后续只应消费 `waveform_url`
- `waveform_url` 指向内容的唯一 v1 shape 已冻结在 `phase3-audio-waveform-document-freeze.md`
- 后续 waveform document v1 consumer 必须直接消费这份冻结协议，不能在产品线里私扩 body shape
- v1 waveform document 只允许：
  - `version=audio_waveform_v1`
  - `duration_ms`
  - `peaks`
- 若 worker 回写 waveform，则每条都必须包含 `asset_id`、`variant_id` 和 `waveform_url`

## Render 规则

- `GetAudioRuntime` 首次读取自动建空 runtime，而不是返回 `not found`
- `RequestAudioRender` 继续复用通用 workflow run，固定 `workflow_type=audio.render_mix`
- timeline 为空时返回 `failed precondition`
- 同一 scope 已有 `queued` 或 `running` render 时，重复触发返回 `failed precondition`
- 请求成功后，runtime 进入：
  - `status=queued`
  - `render_status=queued`
  - `render_workflow_run_id=<workflow_run_id>`
- 请求成功时必须清空旧的 `mix_output`、`waveforms` 和 `last_error_*`
- `ApplyAudioRenderUpdate(render_status=completed)` 必须同时提供：
  - `mix_asset_id`
  - `mix_output`
- `ApplyAudioRenderUpdate(render_status=failed)` 至少提供 `error_code` 或 `error_message`

## Audio SSE

本轮只冻结一条 audio 共享事件：

- `project.audio.runtime.updated`

payload 只允许包含最小 runtime 摘要：

- `project_id`
- `episode_id`
- `audio_runtime_id`
- `render_status`
- `render_workflow_run_id`
- `mix_asset_id`
- `occurred_at`

`mix_output` 和 `waveforms` 都不进 SSE；consumer 只能把这条事件当 invalidation signal，再去 refetch runtime。

## 明确不在本轮范围内

- 音频播放器 UI
- 波形图 consumer
- 波形点数组或采样明细
- 多声道 waveform document
- min/max 包络或播放联动字段
- 音轨级混音段落 richer payload
- 新的音频 SSE payload shape
