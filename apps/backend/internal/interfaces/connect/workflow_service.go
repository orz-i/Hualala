package connect

import (
	"context"
	"time"

	connectrpc "connectrpc.com/connect"
	workflowv1 "github.com/hualala/apps/backend/gen/hualala/workflow/v1"
	workflowv1connect "github.com/hualala/apps/backend/gen/hualala/workflow/v1/workflowv1connect"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type workflowHandler struct {
	workflowv1connect.UnimplementedWorkflowServiceHandler
	service *workflowapp.Service
}

func (h *workflowHandler) StartWorkflow(ctx context.Context, req *connectrpc.Request[workflowv1.StartWorkflowRequest]) (*connectrpc.Response[workflowv1.StartWorkflowResponse], error) {
	record, err := h.service.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID: req.Msg.GetOrganizationId(),
		ProjectID:      req.Msg.GetProjectId(),
		WorkflowType:   req.Msg.GetWorkflowType(),
		ResourceID:     req.Msg.GetResourceId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&workflowv1.StartWorkflowResponse{
		WorkflowRun: mapWorkflowRun(record),
	}), nil
}

func (h *workflowHandler) GetWorkflowRun(ctx context.Context, req *connectrpc.Request[workflowv1.GetWorkflowRunRequest]) (*connectrpc.Response[workflowv1.GetWorkflowRunResponse], error) {
	record, err := h.service.GetWorkflowRun(ctx, workflowapp.GetWorkflowRunInput{
		WorkflowRunID: req.Msg.GetWorkflowRunId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	steps, err := h.service.ListWorkflowSteps(ctx, workflowapp.ListWorkflowStepsInput{
		WorkflowRunID: req.Msg.GetWorkflowRunId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	stepItems := make([]*workflowv1.WorkflowStep, 0, len(steps))
	for _, step := range steps {
		stepItems = append(stepItems, mapWorkflowStep(step))
	}
	return connectrpc.NewResponse(&workflowv1.GetWorkflowRunResponse{
		WorkflowRun:   mapWorkflowRun(record),
		WorkflowSteps: stepItems,
	}), nil
}

func (h *workflowHandler) ListWorkflowRuns(ctx context.Context, req *connectrpc.Request[workflowv1.ListWorkflowRunsRequest]) (*connectrpc.Response[workflowv1.ListWorkflowRunsResponse], error) {
	records, err := h.service.ListWorkflowRuns(ctx, workflowapp.ListWorkflowRunsInput{
		ProjectID:    req.Msg.GetProjectId(),
		ResourceID:   req.Msg.GetResourceId(),
		Status:       req.Msg.GetStatus(),
		WorkflowType: req.Msg.GetWorkflowType(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*workflowv1.WorkflowRun, 0, len(records))
	for _, record := range records {
		items = append(items, mapWorkflowRun(record))
	}
	return connectrpc.NewResponse(&workflowv1.ListWorkflowRunsResponse{
		WorkflowRuns: items,
	}), nil
}

func (h *workflowHandler) CancelWorkflowRun(ctx context.Context, req *connectrpc.Request[workflowv1.CancelWorkflowRunRequest]) (*connectrpc.Response[workflowv1.CancelWorkflowRunResponse], error) {
	record, err := h.service.CancelWorkflowRun(ctx, workflowapp.CancelWorkflowRunInput{
		WorkflowRunID: req.Msg.GetWorkflowRunId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&workflowv1.CancelWorkflowRunResponse{
		WorkflowRun: mapWorkflowRun(record),
	}), nil
}

func (h *workflowHandler) RetryWorkflowRun(ctx context.Context, req *connectrpc.Request[workflowv1.RetryWorkflowRunRequest]) (*connectrpc.Response[workflowv1.RetryWorkflowRunResponse], error) {
	record, err := h.service.RetryWorkflowRun(ctx, workflowapp.RetryWorkflowRunInput{
		WorkflowRunID: req.Msg.GetWorkflowRunId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&workflowv1.RetryWorkflowRunResponse{
		WorkflowRun: mapWorkflowRun(record),
	}), nil
}

func mapWorkflowRun(record workflow.WorkflowRun) *workflowv1.WorkflowRun {
	return &workflowv1.WorkflowRun{
		Id:                record.ID,
		WorkflowType:      record.WorkflowType,
		Status:            record.Status,
		ResourceId:        record.ResourceID,
		ProjectId:         record.ProjectID,
		Provider:          record.Provider,
		CurrentStep:       record.CurrentStep,
		AttemptCount:      int32(record.AttemptCount),
		LastError:         record.LastError,
		ExternalRequestId: record.ExternalRequestID,
		CreatedAt:         timestampOrNil(record.CreatedAt),
		UpdatedAt:         timestampOrNil(record.UpdatedAt),
	}
}

func mapWorkflowStep(record workflow.WorkflowStep) *workflowv1.WorkflowStep {
	return &workflowv1.WorkflowStep{
		Id:            record.ID,
		WorkflowRunId: record.WorkflowRunID,
		StepKey:       record.StepKey,
		StepOrder:     int32(record.StepOrder),
		Status:        record.Status,
		ErrorCode:     record.ErrorCode,
		ErrorMessage:  record.ErrorMessage,
		StartedAt:     timestampOrNil(record.StartedAt),
		CompletedAt:   timestampOrNil(record.CompletedAt),
		FailedAt:      timestampOrNil(record.FailedAt),
	}
}

func timestampOrNil(value time.Time) *timestamppb.Timestamp {
	if value.IsZero() {
		return nil
	}
	return timestamppb.New(value)
}
