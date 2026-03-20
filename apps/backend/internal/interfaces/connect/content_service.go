package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	contentv1 "github.com/hualala/apps/backend/gen/hualala/content/v1"
	contentv1connect "github.com/hualala/apps/backend/gen/hualala/content/v1/contentv1connect"
	"github.com/hualala/apps/backend/internal/application/contentapp"
)

type contentHandler struct {
	contentv1connect.UnimplementedContentServiceHandler
	service *contentapp.Service
}

func (h *contentHandler) CreateScene(ctx context.Context, req *connectrpc.Request[contentv1.CreateSceneRequest]) (*connectrpc.Response[contentv1.CreateSceneResponse], error) {
	record, err := h.service.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
		SceneNo:   int(req.Msg.GetSceneNumber()),
		Title:     req.Msg.GetTitle(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.CreateSceneResponse{
		Scene: mapScene(record),
	}), nil
}

func (h *contentHandler) CreateShot(ctx context.Context, req *connectrpc.Request[contentv1.CreateShotRequest]) (*connectrpc.Response[contentv1.CreateShotResponse], error) {
	record, err := h.service.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: req.Msg.GetSceneId(),
		ShotNo:  int(req.Msg.GetShotNumber()),
		Title:   req.Msg.GetTitle(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.CreateShotResponse{
		Shot: mapShot(record),
	}), nil
}

func (h *contentHandler) ListScenes(ctx context.Context, req *connectrpc.Request[contentv1.ListScenesRequest]) (*connectrpc.Response[contentv1.ListScenesResponse], error) {
	records, err := h.service.ListScenes(ctx, contentapp.ListScenesInput{
		ProjectID: req.Msg.GetProjectId(),
		EpisodeID: req.Msg.GetEpisodeId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	scenes := make([]*contentv1.Scene, 0, len(records))
	for _, record := range records {
		scenes = append(scenes, mapScene(record))
	}
	return connectrpc.NewResponse(&contentv1.ListScenesResponse{
		Scenes: scenes,
	}), nil
}

func (h *contentHandler) GetScene(ctx context.Context, req *connectrpc.Request[contentv1.GetSceneRequest]) (*connectrpc.Response[contentv1.GetSceneResponse], error) {
	record, err := h.service.GetScene(ctx, contentapp.GetSceneInput{
		SceneID: req.Msg.GetSceneId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.GetSceneResponse{
		Scene: mapScene(record),
	}), nil
}

func (h *contentHandler) ListSceneShots(ctx context.Context, req *connectrpc.Request[contentv1.ListSceneShotsRequest]) (*connectrpc.Response[contentv1.ListSceneShotsResponse], error) {
	records, err := h.service.ListSceneShots(ctx, contentapp.ListSceneShotsInput{
		SceneID: req.Msg.GetSceneId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	shots := make([]*contentv1.Shot, 0, len(records))
	for _, record := range records {
		shots = append(shots, mapShot(record))
	}
	return connectrpc.NewResponse(&contentv1.ListSceneShotsResponse{
		Shots: shots,
	}), nil
}

func (h *contentHandler) GetShot(ctx context.Context, req *connectrpc.Request[contentv1.GetShotRequest]) (*connectrpc.Response[contentv1.GetShotResponse], error) {
	record, err := h.service.GetShot(ctx, contentapp.GetShotInput{
		ShotID: req.Msg.GetShotId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.GetShotResponse{
		Shot: mapShot(record),
	}), nil
}

func (h *contentHandler) UpdateShotStructure(ctx context.Context, req *connectrpc.Request[contentv1.UpdateShotStructureRequest]) (*connectrpc.Response[contentv1.UpdateShotStructureResponse], error) {
	record, err := h.service.UpdateShotStructure(ctx, contentapp.UpdateShotStructureInput{
		ShotID:        req.Msg.GetShotId(),
		Title:         req.Msg.GetTitle(),
		ContentLocale: req.Msg.GetContentLocale(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.UpdateShotStructureResponse{
		Shot: mapShot(record),
	}), nil
}

func (h *contentHandler) CreateContentSnapshot(ctx context.Context, req *connectrpc.Request[contentv1.CreateContentSnapshotRequest]) (*connectrpc.Response[contentv1.CreateContentSnapshotResponse], error) {
	record, err := h.service.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     req.Msg.GetOwnerType(),
		OwnerID:       req.Msg.GetOwnerId(),
		ContentLocale: req.Msg.GetContentLocale(),
		Body:          req.Msg.GetBody(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.CreateContentSnapshotResponse{
		Snapshot: mapContentSnapshot(record),
	}), nil
}

func (h *contentHandler) CreateLocalizedSnapshot(ctx context.Context, req *connectrpc.Request[contentv1.CreateLocalizedSnapshotRequest]) (*connectrpc.Response[contentv1.CreateLocalizedSnapshotResponse], error) {
	record, err := h.service.CreateLocalizedSnapshot(ctx, contentapp.CreateLocalizedSnapshotInput{
		SourceSnapshotID: req.Msg.GetSourceSnapshotId(),
		ContentLocale:    req.Msg.GetContentLocale(),
		Body:             req.Msg.GetBody(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&contentv1.CreateLocalizedSnapshotResponse{
		Snapshot: mapContentSnapshot(record),
	}), nil
}
