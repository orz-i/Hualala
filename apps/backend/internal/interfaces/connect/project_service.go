package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
	"github.com/hualala/apps/backend/internal/application/projectapp"
)

type projectHandler struct {
	projectv1connect.UnimplementedProjectServiceHandler
	service *projectapp.Service
}

func (h *projectHandler) CreateProject(ctx context.Context, req *connectrpc.Request[projectv1.CreateProjectRequest]) (*connectrpc.Response[projectv1.CreateProjectResponse], error) {
	record, err := h.service.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID: req.Msg.GetOrgId(),
		OwnerUserID:    req.Msg.GetOwnerUserId(),
		Title:          req.Msg.GetTitle(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.CreateProjectResponse{
		Project: mapProject(record),
	}), nil
}

func (h *projectHandler) CreateEpisode(ctx context.Context, req *connectrpc.Request[projectv1.CreateEpisodeRequest]) (*connectrpc.Response[projectv1.CreateEpisodeResponse], error) {
	record, err := h.service.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeNo: int(req.Msg.GetEpisodeNumber()),
		Title:     req.Msg.GetTitle(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.CreateEpisodeResponse{
		Episode: mapEpisode(record),
	}), nil
}

func (h *projectHandler) GetProject(ctx context.Context, req *connectrpc.Request[projectv1.GetProjectRequest]) (*connectrpc.Response[projectv1.GetProjectResponse], error) {
	record, err := h.service.GetProject(ctx, projectapp.GetProjectInput{
		ProjectID: req.Msg.GetProjectId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.GetProjectResponse{
		Project: mapProject(record),
	}), nil
}

func (h *projectHandler) ListProjects(ctx context.Context, req *connectrpc.Request[projectv1.ListProjectsRequest]) (*connectrpc.Response[projectv1.ListProjectsResponse], error) {
	records, err := h.service.ListProjects(ctx, projectapp.ListProjectsInput{
		OrganizationID: req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	projects := make([]*projectv1.Project, 0, len(records))
	for _, record := range records {
		projects = append(projects, mapProject(record))
	}
	return connectrpc.NewResponse(&projectv1.ListProjectsResponse{
		Projects: projects,
	}), nil
}

func (h *projectHandler) ListEpisodes(ctx context.Context, req *connectrpc.Request[projectv1.ListEpisodesRequest]) (*connectrpc.Response[projectv1.ListEpisodesResponse], error) {
	records, err := h.service.ListEpisodes(ctx, projectapp.ListEpisodesInput{
		ProjectID: req.Msg.GetProjectId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	episodes := make([]*projectv1.Episode, 0, len(records))
	for _, record := range records {
		episodes = append(episodes, mapEpisode(record))
	}
	return connectrpc.NewResponse(&projectv1.ListEpisodesResponse{
		Episodes: episodes,
	}), nil
}

func (h *projectHandler) GetPreviewWorkbench(ctx context.Context, req *connectrpc.Request[projectv1.GetPreviewWorkbenchRequest]) (*connectrpc.Response[projectv1.GetPreviewWorkbenchResponse], error) {
	record, err := h.service.GetPreviewWorkbench(ctx, projectapp.GetPreviewWorkbenchInput{
		ProjectID:     req.Msg.GetProjectId(),
		EpisodeID:     req.Msg.GetEpisodeId(),
		DisplayLocale: req.Msg.GetDisplayLocale(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.GetPreviewWorkbenchResponse{
		Assembly: mapPreviewWorkbench(record),
	}), nil
}

func (h *projectHandler) ListPreviewShotOptions(ctx context.Context, req *connectrpc.Request[projectv1.ListPreviewShotOptionsRequest]) (*connectrpc.Response[projectv1.ListPreviewShotOptionsResponse], error) {
	records, err := h.service.ListPreviewShotOptions(ctx, projectapp.ListPreviewShotOptionsInput{
		ProjectID:     req.Msg.GetProjectId(),
		EpisodeID:     req.Msg.GetEpisodeId(),
		DisplayLocale: req.Msg.GetDisplayLocale(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	options := make([]*projectv1.PreviewShotOption, 0, len(records))
	for _, record := range records {
		options = append(options, mapPreviewShotOption(record))
	}
	return connectrpc.NewResponse(&projectv1.ListPreviewShotOptionsResponse{
		Options: options,
	}), nil
}

func (h *projectHandler) UpsertPreviewAssembly(ctx context.Context, req *connectrpc.Request[projectv1.UpsertPreviewAssemblyRequest]) (*connectrpc.Response[projectv1.UpsertPreviewAssemblyResponse], error) {
	items := make([]projectapp.PreviewAssemblyItemInput, 0, len(req.Msg.GetItems()))
	for _, item := range req.Msg.GetItems() {
		items = append(items, projectapp.PreviewAssemblyItemInput{
			ShotID:         item.GetShotId(),
			PrimaryAssetID: item.GetPrimaryAssetId(),
			SourceRunID:    item.GetSourceRunId(),
			Sequence:       int(item.GetSequence()),
		})
	}
	record, err := h.service.UpsertPreviewAssembly(ctx, projectapp.UpsertPreviewAssemblyInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
		Status:    req.Msg.GetStatus(),
		Items:     items,
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.UpsertPreviewAssemblyResponse{
		Assembly: mapPreviewWorkbench(record),
	}), nil
}

func (h *projectHandler) GetPreviewRuntime(ctx context.Context, req *connectrpc.Request[projectv1.GetPreviewRuntimeRequest]) (*connectrpc.Response[projectv1.GetPreviewRuntimeResponse], error) {
	record, err := h.service.GetPreviewRuntime(ctx, projectapp.GetPreviewRuntimeInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.GetPreviewRuntimeResponse{
		Runtime: mapPreviewRuntime(record),
	}), nil
}

func (h *projectHandler) RequestPreviewRender(ctx context.Context, req *connectrpc.Request[projectv1.RequestPreviewRenderRequest]) (*connectrpc.Response[projectv1.RequestPreviewRenderResponse], error) {
	record, err := h.service.RequestPreviewRender(ctx, projectapp.RequestPreviewRenderInput{
		ProjectID:       req.Msg.GetProjectId(),
		EpisodeID:       req.Msg.GetEpisodeId(),
		RequestedLocale: req.Msg.GetRequestedLocale(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.RequestPreviewRenderResponse{
		Runtime: mapPreviewRuntime(record),
	}), nil
}

func (h *projectHandler) GetAudioWorkbench(ctx context.Context, req *connectrpc.Request[projectv1.GetAudioWorkbenchRequest]) (*connectrpc.Response[projectv1.GetAudioWorkbenchResponse], error) {
	record, err := h.service.GetAudioWorkbench(ctx, projectapp.GetAudioWorkbenchInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.GetAudioWorkbenchResponse{
		Timeline: mapAudioWorkbench(record),
	}), nil
}

func (h *projectHandler) UpsertAudioTimeline(ctx context.Context, req *connectrpc.Request[projectv1.UpsertAudioTimelineRequest]) (*connectrpc.Response[projectv1.UpsertAudioTimelineResponse], error) {
	tracks := make([]projectapp.AudioTrackInput, 0, len(req.Msg.GetTracks()))
	for _, track := range req.Msg.GetTracks() {
		clips := make([]projectapp.AudioClipInput, 0, len(track.GetClips()))
		for _, clip := range track.GetClips() {
			clips = append(clips, projectapp.AudioClipInput{
				AssetID:     clip.GetAssetId(),
				SourceRunID: clip.GetSourceRunId(),
				Sequence:    int(clip.GetSequence()),
				StartMs:     int(clip.GetStartMs()),
				DurationMs:  int(clip.GetDurationMs()),
				TrimInMs:    int(clip.GetTrimInMs()),
				TrimOutMs:   int(clip.GetTrimOutMs()),
			})
		}
		tracks = append(tracks, projectapp.AudioTrackInput{
			TrackType:     track.GetTrackType(),
			DisplayName:   track.GetDisplayName(),
			Sequence:      int(track.GetSequence()),
			Muted:         track.GetMuted(),
			Solo:          track.GetSolo(),
			VolumePercent: int(track.GetVolumePercent()),
			Clips:         clips,
		})
	}

	record, err := h.service.UpsertAudioTimeline(ctx, projectapp.UpsertAudioTimelineInput{
		ProjectID:           req.Msg.GetProjectId(),
		EpisodeID:           req.Msg.GetEpisodeId(),
		Status:              req.Msg.GetStatus(),
		RenderWorkflowRunID: req.Msg.GetRenderWorkflowRunId(),
		RenderStatus:        req.Msg.GetRenderStatus(),
		Tracks:              tracks,
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.UpsertAudioTimelineResponse{
		Timeline: mapAudioWorkbench(record),
	}), nil
}
