package connect

import (
	"context"
	"strings"

	connectrpc "connectrpc.com/connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	"github.com/hualala/apps/backend/internal/application/executionapp"
)

type executionHandler struct {
	executionv1connect.UnimplementedExecutionServiceHandler
	service *executionapp.Service
}

func (h *executionHandler) GetShotWorkbench(ctx context.Context, req *connectrpc.Request[executionv1.GetShotWorkbenchRequest]) (*connectrpc.Response[executionv1.GetShotWorkbenchResponse], error) {
	record, err := h.service.GetShotWorkbench(ctx, executionapp.GetShotWorkbenchInput{
		ShotID: req.Msg.GetShotId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.GetShotWorkbenchResponse{
		Workbench: mapShotWorkbench(record),
	}), nil
}

func (h *executionHandler) GetShotExecution(ctx context.Context, req *connectrpc.Request[executionv1.GetShotExecutionRequest]) (*connectrpc.Response[executionv1.GetShotExecutionResponse], error) {
	record, err := h.service.GetShotExecution(ctx, executionapp.GetShotExecutionInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.GetShotExecutionResponse{
		ShotExecution: mapShotExecution(record),
	}), nil
}

func (h *executionHandler) ListShotExecutionRuns(ctx context.Context, req *connectrpc.Request[executionv1.ListShotExecutionRunsRequest]) (*connectrpc.Response[executionv1.ListShotExecutionRunsResponse], error) {
	records, err := h.service.ListShotExecutionRuns(ctx, executionapp.ListShotExecutionRunsInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	runs := make([]*executionv1.ShotExecutionRun, 0, len(records))
	for _, record := range records {
		runs = append(runs, mapShotExecutionRun(record))
	}
	return connectrpc.NewResponse(&executionv1.ListShotExecutionRunsResponse{
		Runs: runs,
	}), nil
}

func (h *executionHandler) StartShotExecutionRun(ctx context.Context, req *connectrpc.Request[executionv1.StartShotExecutionRunRequest]) (*connectrpc.Response[executionv1.StartShotExecutionRunResponse], error) {
	record, err := h.service.StartShotExecutionRun(ctx, executionapp.StartShotExecutionRunInput{
		ShotID:             req.Msg.GetShotId(),
		OperatorID:         req.Msg.GetOperatorId(),
		ProjectID:          req.Msg.GetProjectId(),
		OrgID:              req.Msg.GetOrgId(),
		TriggerType:        req.Msg.GetTriggerType(),
		EstimatedCostCents: req.Msg.GetEstimatedCostCents(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.StartShotExecutionRunResponse{
		Run: mapShotExecutionRun(record),
	}), nil
}

func (h *executionHandler) SelectPrimaryAsset(ctx context.Context, req *connectrpc.Request[executionv1.SelectPrimaryAssetRequest]) (*connectrpc.Response[executionv1.SelectPrimaryAssetResponse], error) {
	record, err := h.service.SelectPrimaryAsset(ctx, executionapp.SelectPrimaryAssetInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
		AssetID:         req.Msg.GetAssetId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.SelectPrimaryAssetResponse{
		ShotExecution: mapShotExecution(record),
	}), nil
}

func (h *executionHandler) RunSubmissionGateChecks(ctx context.Context, req *connectrpc.Request[executionv1.RunSubmissionGateChecksRequest]) (*connectrpc.Response[executionv1.RunSubmissionGateChecksResponse], error) {
	record, err := h.service.RunSubmissionGateChecks(ctx, executionapp.RunSubmissionGateChecksInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.RunSubmissionGateChecksResponse{
		PassedChecks: record.PassedChecks,
		FailedChecks: record.FailedChecks,
	}), nil
}

func (h *executionHandler) SubmitShotForReview(ctx context.Context, req *connectrpc.Request[executionv1.SubmitShotForReviewRequest]) (*connectrpc.Response[executionv1.SubmitShotForReviewResponse], error) {
	record, err := h.service.SubmitShotForReview(ctx, executionapp.SubmitShotForReviewInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.SubmitShotForReviewResponse{
		ShotExecution: mapShotExecution(record),
	}), nil
}

func (h *executionHandler) MarkShotReworkRequired(ctx context.Context, req *connectrpc.Request[executionv1.MarkShotReworkRequiredRequest]) (*connectrpc.Response[executionv1.MarkShotReworkRequiredResponse], error) {
	record, err := h.service.MarkShotReworkRequired(ctx, executionapp.MarkShotReworkRequiredInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
		Reason:          req.Msg.GetReason(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&executionv1.MarkShotReworkRequiredResponse{
		ShotExecution: mapShotExecution(record),
	}), nil
}

func asConnectError(err error) error {
	if err == nil {
		return nil
	}
	lower := strings.ToLower(err.Error())
	switch {
	case strings.Contains(lower, "unauthenticated"):
		return connectrpc.NewError(connectrpc.CodeUnauthenticated, err)
	case strings.Contains(lower, "permission denied"), strings.Contains(lower, "forbidden"):
		return connectrpc.NewError(connectrpc.CodePermissionDenied, err)
	case strings.Contains(lower, "not found"):
		return connectrpc.NewError(connectrpc.CodeNotFound, err)
	case strings.Contains(lower, "failed precondition"):
		return connectrpc.NewError(connectrpc.CodeFailedPrecondition, err)
	case strings.Contains(lower, "required"),
		strings.Contains(lower, "greater than 0"),
		strings.Contains(lower, "invalid argument"),
		strings.Contains(lower, "budget exceeded"),
		strings.Contains(lower, "cannot be retried"),
		strings.Contains(lower, "cannot be cancelled"):
		return connectrpc.NewError(connectrpc.CodeInvalidArgument, err)
	default:
		return connectrpc.NewError(connectrpc.CodeInternal, err)
	}
}
