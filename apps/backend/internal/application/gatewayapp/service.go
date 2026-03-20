package gatewayapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store   db.GatewayResultStore
	adapter gateway.ProviderAdapter
}

func NewService(store db.GatewayResultStore, adapter gateway.ProviderAdapter) *Service {
	if adapter == nil {
		adapter = NewFakeAdapter()
	}
	return &Service{
		store:   store,
		adapter: adapter,
	}
}

func (s *Service) Execute(ctx context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	if s == nil || s.store == nil {
		return gateway.GatewayResult{}, errors.New("gatewayapp: result store is required")
	}
	if s.adapter == nil {
		return gateway.GatewayResult{}, errors.New("gatewayapp: adapter is required")
	}
	if strings.TrimSpace(request.WorkflowRunID) == "" {
		return gateway.GatewayResult{}, errors.New("gatewayapp: workflow_run_id is required")
	}
	if strings.TrimSpace(request.ResourceID) == "" {
		return gateway.GatewayResult{}, errors.New("gatewayapp: resource_id is required")
	}
	if strings.TrimSpace(request.Provider) == "" {
		return gateway.GatewayResult{}, errors.New("gatewayapp: provider is required")
	}
	if strings.TrimSpace(request.IdempotencyKey) == "" {
		return gateway.GatewayResult{}, errors.New("gatewayapp: idempotency_key is required")
	}

	idempotencyKey := strings.TrimSpace(request.IdempotencyKey)
	if result, ok := s.store.GetGatewayResult(idempotencyKey); ok {
		return result, nil
	}

	result, err := s.adapter.Execute(ctx, request)
	if err != nil {
		return gateway.GatewayResult{}, err
	}
	if strings.TrimSpace(result.ExternalRequestID) == "" {
		result.ExternalRequestID = s.store.GenerateGatewayExternalRequestID()
	}
	if strings.TrimSpace(result.Provider) == "" {
		result.Provider = strings.TrimSpace(request.Provider)
	}
	return result, s.store.SaveGatewayResult(ctx, idempotencyKey, result)
}

type FakeAdapter struct {
	mu               sync.Mutex
	nextExternalID   int
	providerFailures map[string]error
	providerCalls    map[string]int
}

func NewFakeAdapter() *FakeAdapter {
	return &FakeAdapter{
		providerFailures: make(map[string]error),
		providerCalls:    make(map[string]int),
	}
}

func (a *FakeAdapter) Execute(_ context.Context, request gateway.GatewayRequest) (gateway.GatewayResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	provider := strings.TrimSpace(request.Provider)
	a.providerCalls[provider]++
	if err, ok := a.providerFailures[provider]; ok {
		return gateway.GatewayResult{}, err
	}

	a.nextExternalID++
	return gateway.GatewayResult{
		Provider:          provider,
		ExternalRequestID: fmt.Sprintf("external-request-%d", a.nextExternalID),
	}, nil
}

func (a *FakeAdapter) SetProviderFailure(provider string, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.providerFailures[strings.TrimSpace(provider)] = err
}

func (a *FakeAdapter) ClearProviderFailure(provider string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.providerFailures, strings.TrimSpace(provider))
}

func (a *FakeAdapter) CallCount(provider string) int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.providerCalls[strings.TrimSpace(provider)]
}
