package integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/runtime"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

type IntegrationFixture struct {
	Store    db.RuntimeStore
	Factory  runtime.Factory
	Services runtime.ServiceSet
}

func openIntegrationFixture(t *testing.T) *IntegrationFixture {
	t.Helper()

	store := openIntegrationStore(t)
	factory := runtime.NewFactory(store)
	return &IntegrationFixture{
		Store:    store,
		Factory:  factory,
		Services: factory.Services(),
	}
}

func (f *IntegrationFixture) ListProjectEvents(orgID string, projectID string) []events.Event {
	if f == nil || f.Store == nil || f.Store.Publisher() == nil {
		return nil
	}
	return f.Store.Publisher().List(orgID, projectID, "")
}

func (f *IntegrationFixture) ForceWorkflowRunState(t *testing.T, workflowRunID string, mutator func(*workflow.WorkflowRun)) workflow.WorkflowRun {
	t.Helper()

	if f == nil || f.Store == nil {
		t.Fatal("fixture store is required")
	}
	record, ok := f.Store.GetWorkflowRun(workflowRunID)
	if !ok {
		t.Fatalf("workflow run %q not found", workflowRunID)
	}
	mutator(&record)
	if err := f.Store.SaveWorkflowRun(context.Background(), record); err != nil {
		t.Fatalf("SaveWorkflowRun returned error: %v", err)
	}
	return record
}

func (f *IntegrationFixture) SeedBudget(t *testing.T, record billing.ProjectBudget) billing.ProjectBudget {
	t.Helper()

	if f == nil || f.Store == nil {
		t.Fatal("fixture store is required")
	}
	if record.ID == "" {
		record.ID = f.Store.GenerateBudgetID()
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now().UTC()
	}
	if record.UpdatedAt.IsZero() {
		record.UpdatedAt = record.CreatedAt
	}
	if err := f.Store.SaveBudget(context.Background(), record); err != nil {
		t.Fatalf("SaveBudget returned error: %v", err)
	}
	if record.ReservedCents > 0 {
		usage := billing.UsageRecord{
			ID:          f.Store.GenerateUsageRecordID(),
			OrgID:       record.OrgID,
			ProjectID:   record.ProjectID,
			Meter:       "seeded_budget_reserve",
			AmountCents: record.ReservedCents,
			CreatedAt:   record.CreatedAt,
		}
		if err := f.Store.SaveUsageRecord(context.Background(), usage); err != nil {
			t.Fatalf("SaveUsageRecord returned error: %v", err)
		}
		record.ReservedCents = usage.AmountCents
	}
	return record
}

func (f *IntegrationFixture) NewWorkflowServices(adapter *gatewayapp.FakeAdapter) (*policyapp.Service, *gatewayapp.Service, *workflowapp.Service, *workflowapp.Service) {
	policyService := policyapp.NewService(f.Store)
	gatewayService := gatewayapp.NewService(f.Store, adapter)
	apiWorkflowService := workflowapp.NewService(f.Store, f.Store.Publisher(), nil, policyService)
	workerWorkflowService := workflowapp.NewService(f.Store, f.Store.Publisher(), temporal.NewInMemoryExecutor(gatewayService), policyService)
	return policyService, gatewayService, apiWorkflowService, workerWorkflowService
}

func (f *IntegrationFixture) DrainWorkflowJobs(t *testing.T, worker *workflowapp.Service) int {
	t.Helper()

	if worker == nil {
		t.Fatal("worker workflow service is required")
	}

	processedCount := 0
	for {
		processed, err := worker.ProcessNextWorkflowJob(context.Background())
		if err != nil {
			t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
		}
		if !processed {
			return processedCount
		}
		processedCount++
	}
}

func (f *IntegrationFixture) RouteDependencies(overrides func(*runtime.ServiceSet)) connectiface.RouteDependencies {
	services := f.Factory.Services()
	if overrides != nil {
		overrides(&services)
	}
	return connectiface.NewRouteDependencies(services)
}

func (f *IntegrationFixture) NewHTTPServer(t *testing.T, overrides func(*runtime.ServiceSet)) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	connectiface.RegisterRoutes(mux, f.RouteDependencies(overrides))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}
