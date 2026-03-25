package db

import (
	"encoding/json"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
)

type previewTimelineSpinePayload struct {
	Segments        []previewTimelineSegmentPayload `json:"segments,omitempty"`
	TotalDurationMs int                             `json:"total_duration_ms,omitempty"`
}

type previewTimelineSegmentPayload struct {
	SegmentID        string                    `json:"segment_id,omitempty"`
	Sequence         int                       `json:"sequence,omitempty"`
	ShotID           string                    `json:"shot_id,omitempty"`
	ShotCode         string                    `json:"shot_code,omitempty"`
	ShotTitle        string                    `json:"shot_title,omitempty"`
	PlaybackAssetID  string                    `json:"playback_asset_id,omitempty"`
	SourceRunID      string                    `json:"source_run_id,omitempty"`
	StartMs          int                       `json:"start_ms,omitempty"`
	DurationMs       int                       `json:"duration_ms,omitempty"`
	TransitionToNext *previewTransitionPayload `json:"transition_to_next,omitempty"`
}

type previewTransitionPayload struct {
	TransitionType string `json:"transition_type,omitempty"`
	DurationMs     int    `json:"duration_ms,omitempty"`
}

func encodePreviewTimelineSpine(spine project.PreviewTimelineSpine) (any, error) {
	if !hasPreviewTimelineSpineValue(spine) {
		return nil, nil
	}
	body, err := json.Marshal(mapPreviewTimelineSpinePayload(spine))
	if err != nil {
		return nil, err
	}
	return string(body), nil
}

func decodePreviewTimelineSpine(text string) (project.PreviewTimelineSpine, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		return project.PreviewTimelineSpine{}, nil
	}
	var payload previewTimelineSpinePayload
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return project.PreviewTimelineSpine{}, err
	}
	return unmapPreviewTimelineSpinePayload(payload), nil
}

func hasPreviewTimelineSpineValue(spine project.PreviewTimelineSpine) bool {
	return len(spine.Segments) > 0 || spine.TotalDurationMs > 0
}

func mapPreviewTimelineSpinePayload(spine project.PreviewTimelineSpine) previewTimelineSpinePayload {
	segments := make([]previewTimelineSegmentPayload, 0, len(spine.Segments))
	for _, segment := range spine.Segments {
		mapped := previewTimelineSegmentPayload{
			SegmentID:       segment.SegmentID,
			Sequence:        segment.Sequence,
			ShotID:          segment.ShotID,
			ShotCode:        segment.ShotCode,
			ShotTitle:       segment.ShotTitle,
			PlaybackAssetID: segment.PlaybackAssetID,
			SourceRunID:     segment.SourceRunID,
			StartMs:         segment.StartMs,
			DurationMs:      segment.DurationMs,
		}
		if segment.TransitionToNext != nil {
			mapped.TransitionToNext = &previewTransitionPayload{
				TransitionType: segment.TransitionToNext.TransitionType,
				DurationMs:     segment.TransitionToNext.DurationMs,
			}
		}
		segments = append(segments, mapped)
	}
	return previewTimelineSpinePayload{
		Segments:        segments,
		TotalDurationMs: spine.TotalDurationMs,
	}
}

func unmapPreviewTimelineSpinePayload(payload previewTimelineSpinePayload) project.PreviewTimelineSpine {
	segments := make([]project.PreviewTimelineSegment, 0, len(payload.Segments))
	for _, segment := range payload.Segments {
		mapped := project.PreviewTimelineSegment{
			SegmentID:       segment.SegmentID,
			Sequence:        segment.Sequence,
			ShotID:          segment.ShotID,
			ShotCode:        segment.ShotCode,
			ShotTitle:       segment.ShotTitle,
			PlaybackAssetID: segment.PlaybackAssetID,
			SourceRunID:     segment.SourceRunID,
			StartMs:         segment.StartMs,
			DurationMs:      segment.DurationMs,
		}
		if segment.TransitionToNext != nil {
			mapped.TransitionToNext = &project.PreviewTransition{
				TransitionType: segment.TransitionToNext.TransitionType,
				DurationMs:     segment.TransitionToNext.DurationMs,
			}
		}
		segments = append(segments, mapped)
	}
	return project.PreviewTimelineSpine{
		Segments:        segments,
		TotalDurationMs: payload.TotalDurationMs,
	}
}

func clonePreviewRuntimeMap(input map[string]project.PreviewRuntime) map[string]project.PreviewRuntime {
	if len(input) == 0 {
		return make(map[string]project.PreviewRuntime)
	}
	cloned := make(map[string]project.PreviewRuntime, len(input))
	for key, value := range input {
		cloned[key] = clonePreviewRuntime(value)
	}
	return cloned
}

func clonePreviewRuntime(input project.PreviewRuntime) project.PreviewRuntime {
	cloned := input
	cloned.Playback = clonePreviewPlaybackDelivery(input.Playback)
	return cloned
}

func clonePreviewPlaybackDelivery(input project.PreviewPlaybackDelivery) project.PreviewPlaybackDelivery {
	cloned := input
	cloned.Timeline = clonePreviewTimelineSpine(input.Timeline)
	return cloned
}

func clonePreviewTimelineSpine(input project.PreviewTimelineSpine) project.PreviewTimelineSpine {
	if !hasPreviewTimelineSpineValue(input) {
		return project.PreviewTimelineSpine{}
	}
	segments := make([]project.PreviewTimelineSegment, 0, len(input.Segments))
	for _, segment := range input.Segments {
		cloned := segment
		if segment.TransitionToNext != nil {
			cloned.TransitionToNext = &project.PreviewTransition{
				TransitionType: segment.TransitionToNext.TransitionType,
				DurationMs:     segment.TransitionToNext.DurationMs,
			}
		}
		segments = append(segments, cloned)
	}
	return project.PreviewTimelineSpine{
		Segments:        segments,
		TotalDurationMs: input.TotalDurationMs,
	}
}
