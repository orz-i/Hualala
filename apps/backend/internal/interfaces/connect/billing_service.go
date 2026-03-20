package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	"github.com/hualala/apps/backend/internal/application/billingapp"
)

type billingHandler struct {
	billingv1connect.UnimplementedBillingServiceHandler
	service *billingapp.Service
}

func (h *billingHandler) GetBudgetSnapshot(ctx context.Context, req *connectrpc.Request[billingv1.GetBudgetSnapshotRequest]) (*connectrpc.Response[billingv1.GetBudgetSnapshotResponse], error) {
	record, err := h.service.GetBudgetSnapshot(ctx, billingapp.GetBudgetSnapshotInput{
		ProjectID: req.Msg.GetProjectId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&billingv1.GetBudgetSnapshotResponse{
		BudgetSnapshot: mapBudgetSnapshot(record),
	}), nil
}

func (h *billingHandler) ListUsageRecords(ctx context.Context, req *connectrpc.Request[billingv1.ListUsageRecordsRequest]) (*connectrpc.Response[billingv1.ListUsageRecordsResponse], error) {
	records, err := h.service.ListUsageRecords(ctx, billingapp.ListUsageRecordsInput{
		ProjectID: req.Msg.GetProjectId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*billingv1.UsageRecord, 0, len(records))
	for _, record := range records {
		items = append(items, mapUsageRecord(record))
	}
	return connectrpc.NewResponse(&billingv1.ListUsageRecordsResponse{
		UsageRecords: items,
	}), nil
}

func (h *billingHandler) ListBillingEvents(ctx context.Context, req *connectrpc.Request[billingv1.ListBillingEventsRequest]) (*connectrpc.Response[billingv1.ListBillingEventsResponse], error) {
	records, err := h.service.ListBillingEvents(ctx, billingapp.ListBillingEventsInput{
		ProjectID: req.Msg.GetProjectId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*billingv1.BillingEvent, 0, len(records))
	for _, record := range records {
		items = append(items, mapBillingEvent(record))
	}
	return connectrpc.NewResponse(&billingv1.ListBillingEventsResponse{
		BillingEvents: items,
	}), nil
}

func (h *billingHandler) UpdateBudgetPolicy(ctx context.Context, req *connectrpc.Request[billingv1.UpdateBudgetPolicyRequest]) (*connectrpc.Response[billingv1.UpdateBudgetPolicyResponse], error) {
	record, err := h.service.SetProjectBudget(ctx, billingapp.SetProjectBudgetInput{
		ProjectID:  req.Msg.GetProjectId(),
		OrgID:      req.Msg.GetOrgId(),
		LimitCents: req.Msg.GetLimitCents(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&billingv1.UpdateBudgetPolicyResponse{
		BudgetPolicy: mapBudgetPolicy(record),
	}), nil
}
