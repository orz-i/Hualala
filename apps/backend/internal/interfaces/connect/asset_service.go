package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	"github.com/hualala/apps/backend/internal/application/assetapp"
)

type assetHandler struct {
	assetv1connect.UnimplementedAssetServiceHandler
	service *assetapp.Service
}

func (h *assetHandler) CreateImportBatch(ctx context.Context, req *connectrpc.Request[assetv1.CreateImportBatchRequest]) (*connectrpc.Response[assetv1.CreateImportBatchResponse], error) {
	record, err := h.service.CreateImportBatch(ctx, assetapp.CreateImportBatchInput{
		ProjectID:  req.Msg.GetProjectId(),
		OrgID:      req.Msg.GetOrgId(),
		OperatorID: req.Msg.GetOperatorId(),
		SourceType: req.Msg.GetSourceType(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&assetv1.CreateImportBatchResponse{
		ImportBatch: mapImportBatch(record),
	}), nil
}

func (h *assetHandler) AddCandidateAsset(ctx context.Context, req *connectrpc.Request[assetv1.AddCandidateAssetRequest]) (*connectrpc.Response[assetv1.AddCandidateAssetResponse], error) {
	record, err := h.service.AddCandidateAsset(ctx, assetapp.AddCandidateAssetInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
		ProjectID:       req.Msg.GetProjectId(),
		OrgID:           req.Msg.GetOrgId(),
		ImportBatchID:   req.Msg.GetImportBatchId(),
		SourceRunID:     req.Msg.GetSourceRunId(),
		SourceType:      req.Msg.GetSourceType(),
		AssetLocale:     req.Msg.GetAssetLocale(),
		RightsStatus:    req.Msg.GetRightsStatus(),
		AIAnnotated:     req.Msg.GetAiAnnotated(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&assetv1.AddCandidateAssetResponse{
		Asset: mapCandidateAsset(record),
	}), nil
}

func (h *assetHandler) ListImportBatchItems(ctx context.Context, req *connectrpc.Request[assetv1.ListImportBatchItemsRequest]) (*connectrpc.Response[assetv1.ListImportBatchItemsResponse], error) {
	records, err := h.service.ListImportBatchItems(ctx, assetapp.ListImportBatchItemsInput{
		ImportBatchID: req.Msg.GetImportBatchId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*assetv1.ImportBatchItem, 0, len(records))
	for _, record := range records {
		items = append(items, mapImportBatchItem(record))
	}
	return connectrpc.NewResponse(&assetv1.ListImportBatchItemsResponse{
		Items: items,
	}), nil
}

func (h *assetHandler) BatchConfirmImportBatchItems(ctx context.Context, req *connectrpc.Request[assetv1.BatchConfirmImportBatchItemsRequest]) (*connectrpc.Response[assetv1.BatchConfirmImportBatchItemsResponse], error) {
	records, err := h.service.BatchConfirmImportBatchItems(ctx, assetapp.BatchConfirmImportBatchItemsInput{
		ImportBatchID: req.Msg.GetImportBatchId(),
		ItemIDs:       req.Msg.GetItemIds(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*assetv1.ImportBatchItem, 0, len(records))
	for _, record := range records {
		items = append(items, mapImportBatchItem(record))
	}
	return connectrpc.NewResponse(&assetv1.BatchConfirmImportBatchItemsResponse{
		Items: items,
	}), nil
}

func (h *assetHandler) GetImportBatchWorkbench(ctx context.Context, req *connectrpc.Request[assetv1.GetImportBatchWorkbenchRequest]) (*connectrpc.Response[assetv1.GetImportBatchWorkbenchResponse], error) {
	record, err := h.service.GetImportBatchWorkbench(ctx, assetapp.GetImportBatchWorkbenchInput{
		ImportBatchID: req.Msg.GetImportBatchId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}

	uploadSessions := make([]*assetv1.UploadSession, 0, len(record.UploadSessions))
	for _, session := range record.UploadSessions {
		uploadSessions = append(uploadSessions, mapUploadSession(session))
	}
	uploadFiles := make([]*assetv1.UploadFile, 0, len(record.UploadFiles))
	for _, uploadFile := range record.UploadFiles {
		uploadFiles = append(uploadFiles, mapUploadFile(uploadFile))
	}
	mediaAssets := make([]*assetv1.MediaAsset, 0, len(record.MediaAssets))
	for _, mediaAsset := range record.MediaAssets {
		mediaAssets = append(mediaAssets, mapMediaAsset(mediaAsset))
	}
	variants := make([]*assetv1.MediaAssetVariant, 0, len(record.MediaAssetVariants))
	for _, variant := range record.MediaAssetVariants {
		variants = append(variants, mapMediaAssetVariant(variant))
	}
	items := make([]*assetv1.ImportBatchItem, 0, len(record.Items))
	for _, item := range record.Items {
		items = append(items, mapImportBatchItem(item))
	}
	candidates := make([]*assetv1.ShotCandidateAsset, 0, len(record.CandidateAssets))
	for _, candidate := range record.CandidateAssets {
		candidates = append(candidates, mapCandidateAsset(candidate))
	}

	return connectrpc.NewResponse(&assetv1.GetImportBatchWorkbenchResponse{
		ImportBatch:        mapImportBatch(record.ImportBatch),
		UploadSessions:     uploadSessions,
		UploadFiles:        uploadFiles,
		MediaAssets:        mediaAssets,
		MediaAssetVariants: variants,
		Items:              items,
		CandidateAssets:    candidates,
	}), nil
}

func (h *assetHandler) ListCandidateAssets(ctx context.Context, req *connectrpc.Request[assetv1.ListCandidateAssetsRequest]) (*connectrpc.Response[assetv1.ListCandidateAssetsResponse], error) {
	records, err := h.service.ListCandidateAssets(ctx, assetapp.ListCandidateAssetsInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	assets := make([]*assetv1.ShotCandidateAsset, 0, len(records))
	for _, record := range records {
		assets = append(assets, mapCandidateAsset(record))
	}
	return connectrpc.NewResponse(&assetv1.ListCandidateAssetsResponse{
		Assets: assets,
	}), nil
}

func (h *assetHandler) GetAssetProvenanceSummary(ctx context.Context, req *connectrpc.Request[assetv1.GetAssetProvenanceSummaryRequest]) (*connectrpc.Response[assetv1.GetAssetProvenanceSummaryResponse], error) {
	record, err := h.service.GetAssetProvenanceSummary(ctx, assetapp.GetAssetProvenanceSummaryInput{
		AssetID: req.Msg.GetAssetId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&assetv1.GetAssetProvenanceSummaryResponse{
		Asset:             mapMediaAsset(record.Asset),
		ProvenanceSummary: record.ProvenanceSummary,
	}), nil
}
