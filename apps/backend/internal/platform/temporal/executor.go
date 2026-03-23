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

type passthroughExecutor struct {
	executor gatewayExecutor
}

func (e *passthroughExecutor) Execute(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	return e.executor.Execute(ctx, request)
}

// InMemoryExecutor preserves the existing in-process test wiring name.
type InMemoryExecutor = passthroughExecutor

func NewInMemoryExecutor(executor gatewayExecutor) *InMemoryExecutor {
	return &InMemoryExecutor{executor: executor}
}

// DirectExecutor names the same passthrough behavior for production runtime wiring.
type DirectExecutor = passthroughExecutor

func NewDirectExecutor(executor gatewayExecutor) *DirectExecutor {
	return &DirectExecutor{executor: executor}
}
