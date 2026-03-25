package db

import (
	"encoding/json"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/project"
)

type audioWaveformReferencePayload struct {
	AssetID     string `json:"asset_id,omitempty"`
	VariantID   string `json:"variant_id,omitempty"`
	WaveformURL string `json:"waveform_url,omitempty"`
	MimeType    string `json:"mime_type,omitempty"`
	DurationMs  int    `json:"duration_ms,omitempty"`
}

func encodeAudioWaveformReferences(waveforms []project.AudioWaveformReference) (any, error) {
	if len(waveforms) == 0 {
		return nil, nil
	}
	body, err := json.Marshal(mapAudioWaveformReferencePayloads(waveforms))
	if err != nil {
		return nil, err
	}
	return string(body), nil
}

func decodeAudioWaveformReferences(text string) ([]project.AudioWaveformReference, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" {
		return nil, nil
	}
	var payload []audioWaveformReferencePayload
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return nil, err
	}
	return unmapAudioWaveformReferencePayloads(payload), nil
}

func mapAudioWaveformReferencePayloads(waveforms []project.AudioWaveformReference) []audioWaveformReferencePayload {
	if len(waveforms) == 0 {
		return nil
	}
	payload := make([]audioWaveformReferencePayload, 0, len(waveforms))
	for _, waveform := range waveforms {
		payload = append(payload, audioWaveformReferencePayload{
			AssetID:     waveform.AssetID,
			VariantID:   waveform.VariantID,
			WaveformURL: waveform.WaveformURL,
			MimeType:    waveform.MimeType,
			DurationMs:  waveform.DurationMs,
		})
	}
	return payload
}

func unmapAudioWaveformReferencePayloads(payload []audioWaveformReferencePayload) []project.AudioWaveformReference {
	if len(payload) == 0 {
		return nil
	}
	waveforms := make([]project.AudioWaveformReference, 0, len(payload))
	for _, waveform := range payload {
		waveforms = append(waveforms, project.AudioWaveformReference{
			AssetID:     waveform.AssetID,
			VariantID:   waveform.VariantID,
			WaveformURL: waveform.WaveformURL,
			MimeType:    waveform.MimeType,
			DurationMs:  waveform.DurationMs,
		})
	}
	return waveforms
}

func cloneAudioRuntimeMap(input map[string]project.AudioRuntime) map[string]project.AudioRuntime {
	if len(input) == 0 {
		return make(map[string]project.AudioRuntime)
	}
	cloned := make(map[string]project.AudioRuntime, len(input))
	for key, value := range input {
		cloned[key] = cloneAudioRuntime(value)
	}
	return cloned
}

func cloneAudioRuntime(input project.AudioRuntime) project.AudioRuntime {
	cloned := input
	cloned.Waveforms = cloneAudioWaveformReferences(input.Waveforms)
	return cloned
}

func cloneAudioWaveformReferences(input []project.AudioWaveformReference) []project.AudioWaveformReference {
	if len(input) == 0 {
		return nil
	}
	cloned := make([]project.AudioWaveformReference, 0, len(input))
	for _, waveform := range input {
		cloned = append(cloned, waveform)
	}
	return cloned
}
