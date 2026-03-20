package gatewayapp

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestExecuteReturnsStableExternalRequestIDForSameIdempotencyKey(t *testing.T) {
	store := db.NewMemoryStore()
	adapter := NewFakeAdapter()
	service := NewService(store, adapter)

	request := gateway.GatewayRequest{
		WorkflowRunID:  "workflow-run-1",
		ResourceID:     "batch-1",
		Provider:       "seedance",
		IdempotencyKey: "idem-1",
	}

	first, err := service.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}
	second, err := service.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("Execute returned error on repeated idempotency key: %v", err)
	}

	if first.ExternalRequestID == "" {
		t.Fatalf("expected non-empty external_request_id")
	}
	if second.ExternalRequestID != first.ExternalRequestID {
		t.Fatalf("expected stable external_request_id %q, got %q", first.ExternalRequestID, second.ExternalRequestID)
	}
	if got := adapter.CallCount("seedance"); got != 1 {
		t.Fatalf("expected fake adapter to execute once, got %d", got)
	}
}
