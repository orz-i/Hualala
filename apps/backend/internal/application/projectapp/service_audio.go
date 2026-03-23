package projectapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type AudioWorkbench struct {
	Timeline project.AudioTimeline
	Tracks   []project.AudioTrack
}

type GetAudioWorkbenchInput struct {
	ProjectID string
	EpisodeID string
}

type AudioClipInput struct {
	AssetID     string
	SourceRunID string
	Sequence    int
	StartMs     int
	DurationMs  int
	TrimInMs    int
	TrimOutMs   int
}

type AudioTrackInput struct {
	TrackType     string
	DisplayName   string
	Sequence      int
	Muted         bool
	Solo          bool
	VolumePercent int
	Clips         []AudioClipInput
}

type UpsertAudioTimelineInput struct {
	ProjectID           string
	EpisodeID           string
	Status              string
	RenderWorkflowRunID string
	RenderStatus        string
	Tracks              []AudioTrackInput
}

func (s *Service) GetAudioWorkbench(ctx context.Context, input GetAudioWorkbenchInput) (AudioWorkbench, error) {
	if s == nil || s.repo == nil {
		return AudioWorkbench{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return AudioWorkbench{}, err
	}
	record, err := s.ensureAudioTimeline(ctx, projectID, episodeID)
	if err != nil {
		return AudioWorkbench{}, err
	}
	return s.buildAudioWorkbench(record), nil
}

func (s *Service) UpsertAudioTimeline(ctx context.Context, input UpsertAudioTimelineInput) (AudioWorkbench, error) {
	if s == nil || s.repo == nil {
		return AudioWorkbench{}, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return AudioWorkbench{}, err
	}
	record, err := s.ensureAudioTimeline(ctx, projectID, episodeID)
	if err != nil {
		return AudioWorkbench{}, err
	}

	renderWorkflowRunID := strings.TrimSpace(input.RenderWorkflowRunID)
	if renderWorkflowRunID != "" {
		run, ok := s.repo.GetWorkflowRun(renderWorkflowRunID)
		if !ok {
			return AudioWorkbench{}, errors.New("projectapp: render workflow run not found")
		}
		if run.ProjectID != projectID {
			return AudioWorkbench{}, errors.New("projectapp: failed precondition: render workflow scope does not match project")
		}
	}

	now := time.Now().UTC()
	record.Status = defaultAudioTimelineStatus(input.Status)
	record.RenderWorkflowRunID = renderWorkflowRunID
	record.RenderStatus = defaultAudioRenderStatus(input.RenderStatus)
	record.UpdatedAt = now
	if err := s.repo.SaveAudioTimeline(ctx, record); err != nil {
		return AudioWorkbench{}, err
	}

	tracks := make([]project.AudioTrack, 0, len(input.Tracks))
	clipsByTrackID := make(map[string][]project.AudioClip, len(input.Tracks))
	for index, trackInput := range input.Tracks {
		trackType := normalizeTrackType(trackInput.TrackType)
		if trackType == "" {
			return AudioWorkbench{}, errors.New("projectapp: track_type is required")
		}
		displayName := strings.TrimSpace(trackInput.DisplayName)
		if displayName == "" {
			displayName = defaultAudioTrackDisplayName(trackType)
		}
		trackID := s.repo.GenerateAudioTrackID()
		sequence := trackInput.Sequence
		if sequence <= 0 {
			sequence = index + 1
		}
		track := project.AudioTrack{
			ID:            trackID,
			TimelineID:    record.ID,
			TrackType:     trackType,
			DisplayName:   displayName,
			Sequence:      sequence,
			Muted:         trackInput.Muted,
			Solo:          trackInput.Solo,
			VolumePercent: normalizeVolumePercent(trackInput.VolumePercent),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		tracks = append(tracks, track)

		clips := make([]project.AudioClip, 0, len(trackInput.Clips))
		for clipIndex, clipInput := range trackInput.Clips {
			assetID := strings.TrimSpace(clipInput.AssetID)
			if assetID == "" {
				return AudioWorkbench{}, errors.New("projectapp: asset_id is required")
			}
			mediaAsset, ok := s.repo.GetMediaAsset(assetID)
			if !ok {
				return AudioWorkbench{}, fmt.Errorf("projectapp: asset %q not found", assetID)
			}
			if mediaAsset.ProjectID != projectID {
				return AudioWorkbench{}, errors.New("projectapp: failed precondition: asset scope does not match project")
			}
			if strings.TrimSpace(mediaAsset.MediaType) != "" && strings.TrimSpace(mediaAsset.MediaType) != "audio" {
				return AudioWorkbench{}, errors.New("projectapp: failed precondition: asset is not audio")
			}

			sourceRunID := strings.TrimSpace(clipInput.SourceRunID)
			if sourceRunID != "" {
				run, ok := s.repo.GetWorkflowRun(sourceRunID)
				if !ok {
					return AudioWorkbench{}, fmt.Errorf("projectapp: source run %q not found", sourceRunID)
				}
				if run.ProjectID != projectID {
					return AudioWorkbench{}, errors.New("projectapp: failed precondition: source run scope does not match project")
				}
			}

			clipSequence := clipInput.Sequence
			if clipSequence <= 0 {
				clipSequence = clipIndex + 1
			}
			clips = append(clips, project.AudioClip{
				ID:          s.repo.GenerateAudioClipID(),
				TrackID:     trackID,
				AssetID:     assetID,
				SourceRunID: sourceRunID,
				Sequence:    clipSequence,
				StartMs:     clampNonNegative(clipInput.StartMs),
				DurationMs:  clampNonNegative(clipInput.DurationMs),
				TrimInMs:    clampNonNegative(clipInput.TrimInMs),
				TrimOutMs:   clampNonNegative(clipInput.TrimOutMs),
				CreatedAt:   now,
				UpdatedAt:   now,
			})
		}
		clipsByTrackID[trackID] = clips
	}

	if err := s.repo.ReplaceAudioTracks(ctx, record.ID, tracks); err != nil {
		return AudioWorkbench{}, err
	}
	for _, track := range tracks {
		if err := s.repo.ReplaceAudioClips(ctx, track.ID, clipsByTrackID[track.ID]); err != nil {
			return AudioWorkbench{}, err
		}
	}

	return s.buildAudioWorkbench(record), nil
}

func (s *Service) ensureAudioTimeline(ctx context.Context, projectID string, episodeID string) (project.AudioTimeline, error) {
	if record, ok := s.repo.GetAudioTimeline(projectID, episodeID); ok {
		return record, nil
	}
	now := time.Now().UTC()
	record := project.AudioTimeline{
		ID:           s.repo.GenerateAudioTimelineID(),
		ProjectID:    projectID,
		EpisodeID:    episodeID,
		Status:       "draft",
		RenderStatus: "idle",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.SaveAudioTimeline(ctx, record); err != nil {
		if db.IsUniqueViolation(err) {
			if existing, ok := s.repo.GetAudioTimeline(projectID, episodeID); ok {
				return existing, nil
			}
		}
		return project.AudioTimeline{}, err
	}
	return record, nil
}

func (s *Service) buildAudioWorkbench(record project.AudioTimeline) AudioWorkbench {
	tracks := s.repo.ListAudioTracks(record.ID)
	for index := range tracks {
		tracks[index].Clips = s.repo.ListAudioClips(tracks[index].ID)
	}
	return AudioWorkbench{
		Timeline: record,
		Tracks:   tracks,
	}
}

func normalizeTrackType(raw string) string {
	switch strings.TrimSpace(raw) {
	case "dialogue":
		return "dialogue"
	case "voiceover":
		return "voiceover"
	case "bgm":
		return "bgm"
	default:
		return ""
	}
}

func defaultAudioTrackDisplayName(trackType string) string {
	switch trackType {
	case "dialogue":
		return "对白"
	case "voiceover":
		return "旁白"
	case "bgm":
		return "配乐"
	default:
		return "音轨"
	}
}

func defaultAudioTimelineStatus(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "draft"
	}
	return trimmed
}

func defaultAudioRenderStatus(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "idle"
	}
	return trimmed
}

func normalizeVolumePercent(raw int) int {
	if raw < 0 {
		return 0
	}
	return raw
}

func clampNonNegative(raw int) int {
	if raw < 0 {
		return 0
	}
	return raw
}
