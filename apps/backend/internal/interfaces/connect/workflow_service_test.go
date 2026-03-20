package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	workflowv1 "github.com/hualala/apps/backend/gen/hualala/workflow/v1"
	workflowv1connect "github.com/hualala/apps/backend/gen/hualala/workflow/v1/workflowv1connect"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
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
		WorkflowType: "asset.import",
		ResourceId:   "batch-1",
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

	fetched, err := client.GetWorkflowRun(ctx, connectrpc.NewRequest(&workflowv1.GetWorkflowRunRequest{
		WorkflowRunId: runID,
	}))
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := fetched.Msg.GetWorkflowRun().GetId(); got != runID {
		t.Fatalf("expected workflow run %q, got %q", runID, got)
	}

	listed, err := client.ListWorkflowRuns(ctx, connectrpc.NewRequest(&workflowv1.ListWorkflowRunsRequest{}))
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

	secondRunID := store.NextWorkflowRunID()
	store.WorkflowRuns[secondRunID] = workflow.WorkflowRun{
		ID:             secondRunID,
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
}
