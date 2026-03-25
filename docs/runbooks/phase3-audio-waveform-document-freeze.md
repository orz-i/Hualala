# Phase 3 Audio Waveform Document Freeze

## 范围

这份 runbook 只冻结 `AudioWaveformReference.waveform_url` 指向的外部 JSON 文档协议。

本轮 owner 固定为：

- `docs/runbooks/phase3-audio-waveform-document-freeze.md`
- `apps/shared/audio/audioWaveformDocument.ts`
- `tests/e2e/fixtures/mock-connect/audio.ts`
- `tests/e2e/fixtures/mockConnectRoutes.ts`

本轮不修改 `ProjectService`、`AudioRuntime` proto、SDK public API、SSE payload 或 DB schema。
本轮也不包含 creator/admin 图形波形 UI、`<canvas>`、`<svg>`、播放头联动或下载交互。

## Waveform Document V1

`waveform_url` 指向内容的唯一 v1 shape 为：

- `version`
- `duration_ms`
- `peaks`

规则固定为：

- `version` 必须等于 `audio_waveform_v1`
- `duration_ms` 必须是正整数
- `peaks` 必须是非空数组
- `peaks[*]` 必须是 `0..1` 之间的有限数值

## 文档语义

v1 只表达单通道归一化包络：

- `duration_ms` 是整段 waveform 文档覆盖的总时长
- `peaks` 是等距 bucket 的归一化强度

本轮明确不在文档 body 里加入：

- `asset_id`
- `variant_id`
- `mime_type`
- `channels`
- `min/max`
- 原始采样数组
- bucket 级时间戳
- 播放联动信息

这些元数据继续只来自 `AudioRuntime.waveforms[*]` 引用层。

## Consumer 规则

- 后续 waveform consumer 必须消费这份冻结后的 `audio_waveform_v1`
- 无效文档必须 fail-closed，不能静默吞成合法数据
- v1 只保证 `duration_ms + peaks`；如果后续需要多声道、min/max 包络或更细精度，必须拆新的 foundation patch
