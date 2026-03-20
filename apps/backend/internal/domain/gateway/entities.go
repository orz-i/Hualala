package gateway

import "context"

type GatewayRequest struct {
	WorkflowRunID     string
	ResourceID        string
	Provider          string
	IdempotencyKey    string
	ExternalRequestID string
}

type GatewayResult struct {
	Provider          string
	ExternalRequestID string
}

type ProviderAdapter interface {
	Execute(context.Context, GatewayRequest) (GatewayResult, error)
}
