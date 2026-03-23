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
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&projectv1.GetPreviewWorkbenchResponse{
		Assembly: mapPreviewWorkbench(record),
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
