package connect

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	connectrpc "connectrpc.com/connect"
	workflowv1 "github.com/hualala/apps/backend/gen/hualala/workflow/v1"
	workflowv1connect "github.com/hualala/apps/backend/gen/hualala/workflow/v1/workflowv1connect"
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/runtime"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

func TestWorkflowRoutesQueueAndExposeWorkerProgress(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	factory := runtime.NewFactory(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(factory.Services()))
	server := httptest.NewServer(mux)
	defer server.Close()

	client := workflowv1connect.NewWorkflowServiceClient(server.Client(), server.URL)

	started, err := client.StartWorkflow(ctx, connectrpc.NewRequest(&workflowv1.StartWorkflowRequest{
		OrganizationId: "org-1",
		ProjectId:      "project-1",
		WorkflowType:   "asset.import",
		ResourceId:     "batch-1",
	}))
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}
	runID := started.Msg.GetWorkflowRun().GetId()
	if runID == "" {
		t.Fatalf("expected workflow run id")
	}
	if got := started.Msg.GetWorkflowRun().GetStatus(); got != "pending" {
		t.Fatalf("expected pending workflow status, got %q", got)
	}
	if got := started.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.dispatch" {
		t.Fatalf("expected current_step attempt_1.dispatch, got %q", got)
	}
	if got := started.Msg.GetWorkflowRun().GetExternalRequestId(); got != "" {
		t.Fatalf("expected empty external_request_id before worker processing, got %q", got)
	}

	fetchedPending, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := fetchedPending.Msg.GetWorkflowRun().GetProvider(); got != "seedance" {
		t.Fatalf("expected provider seedance, got %q", got)
	}
	if got := fetchedPending.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.dispatch" {
		t.Fatalf("expected current_step attempt_1.dispatch, got %q", got)
	}
	if got := fetchedPending.Msg.GetWorkflowRun().GetAttemptCount(); got != 1 {
		t.Fatalf("expected attempt_count 1, got %d", got)
	}
	if got := fetchedPending.Msg.GetWorkflowRun().GetExternalRequestId(); got != "" {
		t.Fatalf("expected pending run to hide external_request_id, got %q", got)
	}
	if len(fetchedPending.Msg.GetWorkflowSteps()) != 1 {
		t.Fatalf("expected 1 workflow step before worker processing, got %d", len(fetchedPending.Msg.GetWorkflowSteps()))
	}

	processed, err := factory.WorkerServices().WorkflowService.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected worker to process queued workflow job")
	}

	fetchedCompleted, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun after worker returned error: %v", err)
	}
	if got := fetchedCompleted.Msg.GetWorkflowRun().GetStatus(); got != "completed" {
		t.Fatalf("expected completed workflow status after worker processing, got %q", got)
	}
	if got := fetchedCompleted.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.gateway" {
		t.Fatalf("expected current_step attempt_1.gateway, got %q", got)
	}
	if fetchedCompleted.Msg.GetWorkflowRun().GetExternalRequestId() == "" {
		t.Fatalf("expected worker to populate external_request_id")
	}
	if len(fetchedCompleted.Msg.GetWorkflowSteps()) != 2 {
		t.Fatalf("expected 2 workflow steps after worker processing, got %d", len(fetchedCompleted.Msg.GetWorkflowSteps()))
	}

	listed, err := client.ListWorkflowRuns(ctx, connectrpc.NewRequest(&workflowv1.ListWorkflowRunsRequest{
		ProjectId:    "project-1",
		ResourceId:   "batch-1",
		Status:       "completed",
		WorkflowType: "asset.import",
	}))
	if err != nil {
		t.Fatalf("ListWorkflowRuns returned error: %v", err)
	}
	if len(listed.Msg.GetWorkflowRuns()) != 1 {
		t.Fatalf("expected 1 completed workflow run, got %d", len(listed.Msg.GetWorkflowRuns()))
	}

	_, err = client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err == nil {
		t.Fatalf("expected cancel on completed workflow run to be rejected")
	}
	if !strings.Contains(err.Error(), "policyapp: completed workflow run cannot be cancelled") {
		t.Fatalf("expected completed cancel rejection message, got %v", err)
	}
}

func TestWorkflowRoutesExposeProviderFailureAndPolicyRejections(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	adapter := gatewayapp.NewFakeAdapter()
	adapter.SetProviderFailure("seedance", errors.New("provider failed"))
	policyService := policyapp.NewService(store)
	workerService := workflowapp.NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gatewayapp.NewService(store, adapter)), policyService)
	apiService := workflowapp.NewService(store, store.Publisher(), nil, policyService)

	services := runtime.NewFactory(store).Services()
	services.WorkflowService = apiService

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(services))
	server := httptest.NewServer(mux)
	defer server.Close()

	client := workflowv1connect.NewWorkflowServiceClient(server.Client(), server.URL)

	failedQueued, err := client.StartWorkflow(ctx, connectrpc.NewRequest(&workflowv1.StartWorkflowRequest{
		OrganizationId: "org-1",
		ProjectId:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceId:     "shot-exec-1",
	}))
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	processed, err := workerService.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected worker to process failed workflow job")
	}

	fetchedFailed, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: failedQueued.Msg.GetWorkflowRun().GetId(),
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := fetchedFailed.Msg.GetWorkflowRun().GetStatus(); got != "failed" {
		t.Fatalf("expected failed workflow status, got %q", got)
	}
	if len(fetchedFailed.Msg.GetWorkflowSteps()) != 2 {
		t.Fatalf("expected 2 workflow steps after provider failure, got %d", len(fetchedFailed.Msg.GetWorkflowSteps()))
	}
	if got := fetchedFailed.Msg.GetWorkflowSteps()[1].GetErrorCode(); got != "provider_error" {
		t.Fatalf("expected gateway step error_code provider_error, got %q", got)
	}
	if got := fetchedFailed.Msg.GetWorkflowSteps()[1].GetErrorMessage(); got != "provider failed" {
		t.Fatalf("expected gateway step error_message provider failed, got %q", got)
	}

	queuedForCancel, err := client.StartWorkflow(ctx, connectrpc.NewRequest(&workflowv1.StartWorkflowRequest{
		OrganizationId: "org-1",
		ProjectId:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceId:     "shot-exec-pending",
	}))
	if err != nil {
		t.Fatalf("StartWorkflow for pending cancel returned error: %v", err)
	}
	cancelled, err := client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: queuedForCancel.Msg.GetWorkflowRun().GetId(),
	}))
	if err != nil {
		t.Fatalf("CancelWorkflowRun for pending workflow returned error: %v", err)
	}
	if got := cancelled.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.cancel" {
		t.Fatalf("expected pending cancel current_step attempt_1.cancel, got %q", got)
	}

	adapter.ClearProviderFailure("seedance")
	runningQueued, err := client.StartWorkflow(ctx, connectrpc.NewRequest(&workflowv1.StartWorkflowRequest{
		OrganizationId: "org-1",
		ProjectId:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceId:     "shot-exec-running",
	}))
	if err != nil {
		t.Fatalf("StartWorkflow for running workflow returned error: %v", err)
	}
	processed, err = workerService.ProcessNextWorkflowJob(ctx)
	if err != nil {
		t.Fatalf("ProcessNextWorkflowJob for completed workflow returned error: %v", err)
	}
	if !processed {
		t.Fatalf("expected worker to process completed workflow job")
	}

	_, err = client.RetryWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.RetryWorkflowRunRequest{
		WorkflowRunId: runningQueued.Msg.GetWorkflowRun().GetId(),
	}))
	if err == nil {
		t.Fatalf("expected retry on completed workflow run to be rejected")
	}
	if !strings.Contains(err.Error(), "policyapp: completed workflow run cannot be retried") {
		t.Fatalf("expected completed retry rejection message, got %v", err)
	}

	_, err = client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: failedQueued.Msg.GetWorkflowRun().GetId(),
	}))
	if err == nil {
		t.Fatalf("expected cancel on failed workflow run to be rejected")
	}
	if !strings.Contains(err.Error(), "policyapp: failed workflow run cannot be cancelled") {
		t.Fatalf("expected failed cancel rejection message, got %v", err)
	}
}
