package temporal

import (
	"context"

	"github.com/hualala/apps/backend/internal/domain/gateway"
)

type Executor interface {
	Execute(context.Context, gateway.GatewayRequest) (gateway.GatewayResult, error)
}

type gatewayExecutor interface {
	Execute(context.Context, gateway.GatewayRequest) (gateway.GatewayResult, error)
}

type InMemoryExecutor struct {
	executor gatewayExecutor
}

func NewInMemoryExecutor(executor gatewayExecutor) *InMemoryExecutor {
	return &InMemoryExecutor{executor: executor}
}

func (e *InMemoryExecutor) Execute(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	return e.executor.Execute(ctx, request)
}

type DirectExecutor struct {
	executor gatewayExecutor
}

func NewDirectExecutor(executor gatewayExecutor) *DirectExecutor {
	return &DirectExecutor{executor: executor}
}

func (e *DirectExecutor) Execute(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	return e.executor.Execute(ctx, request)
}
