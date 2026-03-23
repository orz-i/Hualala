package connect

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	workflowv1 "github.com/hualala/apps/backend/gen/hualala/workflow/v1"
	workflowv1connect "github.com/hualala/apps/backend/gen/hualala/workflow/v1/workflowv1connect"
	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/temporal"
)

func TestWorkflowRoutes(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
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
	if got := started.Msg.GetWorkflowRun().GetStatus(); got != "running" {
		t.Fatalf("expected running workflow status, got %q", got)
	}
	if got := started.Msg.GetWorkflowRun().GetResourceId(); got != "batch-1" {
		t.Fatalf("expected resource_id %q, got %q", "batch-1", got)
	}
	if got := started.Msg.GetWorkflowRun().GetProjectId(); got != "project-1" {
		t.Fatalf("expected project_id %q, got %q", "project-1", got)
	}

	fetched, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := fetched.Msg.GetWorkflowRun().GetId(); got != runID {
		t.Fatalf("expected workflow run %q, got %q", runID, got)
	}
	if got := fetched.Msg.GetWorkflowRun().GetProvider(); got != "seedance" {
		t.Fatalf("expected provider seedance, got %q", got)
	}
	if got := fetched.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.gateway" {
		t.Fatalf("expected current_step attempt_1.gateway, got %q", got)
	}
	if got := fetched.Msg.GetWorkflowRun().GetAttemptCount(); got != 1 {
		t.Fatalf("expected attempt_count 1, got %d", got)
	}
	if fetched.Msg.GetWorkflowRun().GetExternalRequestId() == "" {
		t.Fatalf("expected external_request_id to be populated")
	}
	if len(fetched.Msg.GetWorkflowSteps()) != 2 {
		t.Fatalf("expected 2 workflow steps, got %d", len(fetched.Msg.GetWorkflowSteps()))
	}
	if got := fetched.Msg.GetWorkflowSteps()[0].GetStepKey(); got != "attempt_1.dispatch" {
		t.Fatalf("expected first workflow step attempt_1.dispatch, got %q", got)
	}

	listed, err := client.ListWorkflowRuns(ctx, connectrpc.NewRequest(&workflowv1.ListWorkflowRunsRequest{
		ProjectId:    "project-1",
		ResourceId:   "batch-1",
		Status:       "running",
		WorkflowType: "asset.import",
	}))
	if err != nil {
		t.Fatalf("ListWorkflowRuns returned error: %v", err)
	}
	if len(listed.Msg.GetWorkflowRuns()) != 1 {
		t.Fatalf("expected 1 workflow run, got %d", len(listed.Msg.GetWorkflowRuns()))
	}

	cancelled, err := client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("CancelWorkflowRun returned error: %v", err)
	}
	if got := cancelled.Msg.GetWorkflowRun().GetStatus(); got != "cancelled" {
		t.Fatalf("expected cancelled workflow status, got %q", got)
	}
	cancelledDetails, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun after cancel returned error: %v", err)
	}
	if got := cancelledDetails.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.cancel" {
		t.Fatalf("expected current_step attempt_1.cancel after cancel, got %q", got)
	}
	if len(cancelledDetails.Msg.GetWorkflowSteps()) != 3 {
		t.Fatalf("expected 3 workflow steps after cancel, got %d", len(cancelledDetails.Msg.GetWorkflowSteps()))
	}
	if got := cancelledDetails.Msg.GetWorkflowSteps()[2].GetStepKey(); got != "attempt_1.cancel" {
		t.Fatalf("expected cancel step attempt_1.cancel, got %q", got)
	}

	secondRunID := store.NextWorkflowRunID()
	store.WorkflowRuns[secondRunID] = workflow.WorkflowRun{
		ID:             secondRunID,
		OrgID:          "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "asset.import",
		ResourceID:     "batch-2",
		Status:         "failed",
		LastError:      "provider failed",
		AttemptCount:   1,
		CurrentStep:    "dispatch",
		Provider:       "seedance",
		IdempotencyKey: "idem-2",
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	retried, err := client.RetryWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.RetryWorkflowRunRequest{
		WorkflowRunId: secondRunID,
	}))
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error: %v", err)
	}
	if got := retried.Msg.GetWorkflowRun().GetStatus(); got != "running" {
		t.Fatalf("expected running workflow status after retry, got %q", got)
	}
	if got := retried.Msg.GetWorkflowRun().GetResourceId(); got != "batch-2" {
		t.Fatalf("expected retried resource_id %q, got %q", "batch-2", got)
	}
	if got := retried.Msg.GetWorkflowRun().GetAttemptCount(); got != 2 {
		t.Fatalf("expected retried attempt_count 2, got %d", got)
	}
}

func TestWorkflowRoutesExposeProviderErrorAndPolicyRejections(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	adapter := gatewayapp.NewFakeAdapter()
	adapter.SetProviderFailure("seedance", errors.New("provider failed"))
	service := workflowapp.NewService(store, store.Publisher(), temporal.NewInMemoryExecutor(gatewayapp.NewService(store, adapter)), policyapp.NewService(store))
	failed, err := service.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceID:     "shot-exec-1",
		Provider:       "seedance",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	client := workflowv1connect.NewWorkflowServiceClient(server.Client(), server.URL)

	fetched, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: failed.ID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if len(fetched.Msg.GetWorkflowSteps()) != 2 {
		t.Fatalf("expected 2 workflow steps, got %d", len(fetched.Msg.GetWorkflowSteps()))
	}
	if got := fetched.Msg.GetWorkflowSteps()[1].GetErrorCode(); got != "provider_error" {
		t.Fatalf("expected gateway step error_code provider_error, got %q", got)
	}
	if got := fetched.Msg.GetWorkflowSteps()[1].GetErrorMessage(); got != "provider failed" {
		t.Fatalf("expected gateway step error_message provider failed, got %q", got)
	}

	running, err := client.StartWorkflow(ctx, connectrpc.NewRequest(&workflowv1.StartWorkflowRequest{
		OrganizationId: "org-1",
		ProjectId:      "project-1",
		WorkflowType:   "shot_pipeline",
		ResourceId:     "shot-exec-2",
	}))
	if err != nil {
		t.Fatalf("StartWorkflow for running run returned error: %v", err)
	}

	_, err = client.RetryWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.RetryWorkflowRunRequest{
		WorkflowRunId: running.Msg.GetWorkflowRun().GetId(),
	}))
	if err == nil {
		t.Fatalf("expected retry on running workflow run to be rejected")
	}
	if !strings.Contains(err.Error(), "policyapp: running workflow run cannot be retried") {
		t.Fatalf("expected running retry rejection message, got %v", err)
	}

	cancelled, err := client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: running.Msg.GetWorkflowRun().GetId(),
	}))
	if err != nil {
		t.Fatalf("CancelWorkflowRun returned error: %v", err)
	}
	if got := cancelled.Msg.GetWorkflowRun().GetCurrentStep(); got != "attempt_1.cancel" {
		t.Fatalf("expected cancelled workflow current_step attempt_1.cancel, got %q", got)
	}

	_, err = client.CancelWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.CancelWorkflowRunRequest{
		WorkflowRunId: failed.ID,
	}))
	if err == nil {
		t.Fatalf("expected cancel on failed workflow run to be rejected")
	}
	if !strings.Contains(err.Error(), "policyapp: failed workflow run cannot be cancelled") {
		t.Fatalf("expected failed cancel rejection message, got %v", err)
	}
}
