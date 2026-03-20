package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
)

type reviewHandler struct {
	reviewv1connect.UnimplementedReviewServiceHandler
	service *reviewapp.Service
}

func (h *reviewHandler) ListEvaluationRuns(ctx context.Context, req *connectrpc.Request[reviewv1.ListEvaluationRunsRequest]) (*connectrpc.Response[reviewv1.ListEvaluationRunsResponse], error) {
	records, err := h.service.ListEvaluationRuns(ctx, reviewapp.ListEvaluationRunsInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	runs := make([]*reviewv1.EvaluationRun, 0, len(records))
	for _, record := range records {
		runs = append(runs, mapEvaluationRun(record))
	}
	return connectrpc.NewResponse(&reviewv1.ListEvaluationRunsResponse{
		EvaluationRuns: runs,
	}), nil
}

func (h *reviewHandler) CreateEvaluationRun(ctx context.Context, req *connectrpc.Request[reviewv1.CreateEvaluationRunRequest]) (*connectrpc.Response[reviewv1.CreateEvaluationRunResponse], error) {
	record, err := h.service.CreateEvaluationRun(ctx, reviewapp.CreateEvaluationRunInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
		PassedChecks:    req.Msg.GetPassedChecks(),
		FailedChecks:    req.Msg.GetFailedChecks(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&reviewv1.CreateEvaluationRunResponse{
		EvaluationRun: mapEvaluationRun(record),
	}), nil
}

func (h *reviewHandler) ListShotReviews(ctx context.Context, req *connectrpc.Request[reviewv1.ListShotReviewsRequest]) (*connectrpc.Response[reviewv1.ListShotReviewsResponse], error) {
	records, err := h.service.ListShotReviews(ctx, reviewapp.ListShotReviewsInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	reviews := make([]*reviewv1.ShotReview, 0, len(records))
	for _, record := range records {
		reviews = append(reviews, mapShotReview(record))
	}
	return connectrpc.NewResponse(&reviewv1.ListShotReviewsResponse{
		ShotReviews: reviews,
	}), nil
}

func (h *reviewHandler) CreateShotReview(ctx context.Context, req *connectrpc.Request[reviewv1.CreateShotReviewRequest]) (*connectrpc.Response[reviewv1.CreateShotReviewResponse], error) {
	record, err := h.service.CreateShotReview(ctx, reviewapp.CreateShotReviewInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
		Conclusion:      req.Msg.GetConclusion(),
		CommentLocale:   req.Msg.GetCommentLocale(),
		Comment:         req.Msg.GetComment(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&reviewv1.CreateShotReviewResponse{
		ShotReview: mapShotReview(record),
	}), nil
}

func (h *reviewHandler) GetShotReviewSummary(ctx context.Context, req *connectrpc.Request[reviewv1.GetShotReviewSummaryRequest]) (*connectrpc.Response[reviewv1.GetShotReviewSummaryResponse], error) {
	record, err := h.service.GetShotReviewSummary(ctx, reviewapp.GetShotReviewSummaryInput{
		ShotExecutionID: req.Msg.GetShotExecutionId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&reviewv1.GetShotReviewSummaryResponse{
		Summary: mapShotReviewSummary(record),
	}), nil
}
