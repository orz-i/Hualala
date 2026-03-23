package temporal

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/domain/gateway"
)

type stubGatewayExecutor struct {
	request gateway.GatewayRequest
	result  gateway.GatewayResult
	called  bool
}

func (s *stubGatewayExecutor) Execute(_ context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	s.called = true
	s.request = request
	return s.result, nil
}

func TestConstructorsDelegateToWrappedExecutor(t *testing.T) {
	request := gateway.GatewayRequest{
		WorkflowRunID: "wf_123",
		Provider:      "seedance",
	}
	result := gateway.GatewayResult{
		ExternalRequestID: "external_123",
		Provider:          "seedance",
	}

	tests := []struct {
		name        string
		constructor func(gatewayExecutor) Executor
	}{
		{
			name: "in-memory",
			constructor: func(executor gatewayExecutor) Executor {
				return NewInMemoryExecutor(executor)
			},
		},
		{
			name: "direct",
			constructor: func(executor gatewayExecutor) Executor {
				return NewDirectExecutor(executor)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &stubGatewayExecutor{result: result}

			executor := tt.constructor(stub)
			got, err := executor.Execute(context.Background(), request)
			if err != nil {
				t.Fatalf("Execute() error = %v", err)
			}
			if !stub.called {
				t.Fatal("Execute() did not delegate to wrapped executor")
			}
			if stub.request != request {
				t.Fatalf("wrapped executor request = %+v, want %+v", stub.request, request)
			}
			if got != result {
				t.Fatalf("Execute() result = %+v, want %+v", got, result)
			}
		})
	}
}
