package integration

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/gatewayapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

func TestReliabilityFlow(t *testing.T) {
	ctx := context.Background()
	fixture := openIntegrationFixture(t)
	projectService := fixture.Services.ProjectService
	adapter := gatewayapp.NewFakeAdapter()
	adapter.SetProviderFailure("seedance", errors.New("provider failed"))
	policyService, gatewayService, apiWorkflowService, workerWorkflowService := fixture.NewWorkflowServices(adapter)
	server := fixture.NewHTTPServer(t, func(services *runtime.ServiceSet) {
		services.PolicyService = policyService
		services.GatewayService = gatewayService
		services.WorkflowService = apiWorkflowService
	})

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   "Reliability Project",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	failedQueued, err := apiWorkflowService.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID:     project.OrganizationID,
		ProjectID:          project.ID,
		WorkflowType:       "asset.import",
		ResourceID:         "batch-1",
		IdempotencyKey:     "idem-workflow-failed",
		EstimatedCostCents: 10,
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}
	if got := failedQueued.Provider; got != "seedance" {
		t.Fatalf("expected queued workflow provider seedance, got %q", got)
	}
	if got := failedQueued.Status; got != workflow.StatusPending {
		t.Fatalf("expected queued workflow status pending, got %q", got)
	}

	events := fixture.ListProjectEvents(project.OrganizationID, project.ID)
	if len(events) < 1 {
		t.Fatalf("expected pending workflow event, got %d", len(events))
	}
	if got := events[0].EventType; got != "workflow.updated" {
		t.Fatalf("expected first event workflow.updated, got %q", got)
	}
	if !strings.Contains(events[0].Payload, `"status":"pending"`) {
		t.Fatalf("expected pending payload in first event, got %q", events[0].Payload)
	}

	if processedCount := fixture.DrainWorkflowJobs(t, workerWorkflowService); processedCount != 1 {
		t.Fatalf("expected 1 workflow job to be drained, got %d", processedCount)
	}

	failedRun, err := apiWorkflowService.GetWorkflowRun(ctx, workflowapp.GetWorkflowRunInput{
		WorkflowRunID: failedQueued.ID,
	})
	if err != nil {
		t.Fatalf("GetWorkflowRun returned error: %v", err)
	}
	if got := failedRun.Status; got != workflow.StatusFailed {
		t.Fatalf("expected failed workflow status, got %q", got)
	}

	events = fixture.ListProjectEvents(project.OrganizationID, project.ID)
	if len(events) < 3 {
		t.Fatalf("expected pending/running/failed workflow events, got %d", len(events))
	}
	if !strings.Contains(events[1].Payload, `"status":"running"`) {
		t.Fatalf("expected running payload in second event, got %q", events[1].Payload)
	}
	if !strings.Contains(events[2].Payload, `"status":"failed"`) {
		t.Fatalf("expected failed payload in third event, got %q", events[2].Payload)
	}

	adapter.ClearProviderFailure("seedance")
	retried, err := apiWorkflowService.RetryWorkflowRun(ctx, workflowapp.RetryWorkflowRunInput{
		WorkflowRunID: failedRun.ID,
	})
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error: %v", err)
	}
	if got := retried.Status; got != workflow.StatusPending {
		t.Fatalf("expected queued retry status pending, got %q", got)
	}
	if got := retried.AttemptCount; got != 2 {
		t.Fatalf("expected attempt_count 2, got %d", got)
	}
	if got := retried.ExternalRequestID; got != "" {
		t.Fatalf("expected retry response to clear external_request_id, got %q", got)
	}
	if processedCount := fixture.DrainWorkflowJobs(t, workerWorkflowService); processedCount != 1 {
		t.Fatalf("expected retried workflow job to be drained once, got %d", processedCount)
	}

	runningRun, err := apiWorkflowService.GetWorkflowRun(ctx, workflowapp.GetWorkflowRunInput{
		WorkflowRunID: failedRun.ID,
	})
	if err != nil {
		t.Fatalf("GetWorkflowRun after retry returned error: %v", err)
	}
	if got := runningRun.Status; got != workflow.StatusRunning {
		t.Fatalf("expected running workflow status after retry dispatch, got %q", got)
	}

	successQueued, err := apiWorkflowService.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID:     project.OrganizationID,
		ProjectID:          project.ID,
		WorkflowType:       "asset.import",
		ResourceID:         "batch-2",
		IdempotencyKey:     "idem-workflow-stable",
		EstimatedCostCents: 10,
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error for idempotency case: %v", err)
	}
	if processedCount := fixture.DrainWorkflowJobs(t, workerWorkflowService); processedCount != 1 {
		t.Fatalf("expected successful workflow job to be drained once, got %d", processedCount)
	}

	successRun, err := apiWorkflowService.GetWorkflowRun(ctx, workflowapp.GetWorkflowRunInput{
		WorkflowRunID: successQueued.ID,
	})
	if err != nil {
		t.Fatalf("GetWorkflowRun for idempotency case returned error: %v", err)
	}
	if successRun.ExternalRequestID == "" {
		t.Fatalf("expected external_request_id for successful workflow")
	}
	fixture.ForceWorkflowRunState(t, successRun.ID, func(record *workflow.WorkflowRun) {
		record.Status = workflow.StatusFailed
		record.LastError = "transient provider failure"
		record.UpdatedAt = time.Now().UTC()
	})

	replayed, err := apiWorkflowService.RetryWorkflowRun(ctx, workflowapp.RetryWorkflowRunInput{
		WorkflowRunID: successRun.ID,
	})
	if err != nil {
		t.Fatalf("RetryWorkflowRun returned error for idempotency case: %v", err)
	}
	if got := replayed.ExternalRequestID; got != "" {
		t.Fatalf("expected queued retry to hide external_request_id, got %q", got)
	}
	if processedCount := fixture.DrainWorkflowJobs(t, workerWorkflowService); processedCount != 1 {
		t.Fatalf("expected replayed workflow job to be drained once, got %d", processedCount)
	}

	replayedRun, err := apiWorkflowService.GetWorkflowRun(ctx, workflowapp.GetWorkflowRunInput{
		WorkflowRunID: successRun.ID,
	})
	if err != nil {
		t.Fatalf("GetWorkflowRun after replay returned error: %v", err)
	}
	if got := replayedRun.ExternalRequestID; got != successRun.ExternalRequestID {
		t.Fatalf("expected stable external_request_id %q, got %q", successRun.ExternalRequestID, got)
	}

	fixture.SeedBudget(t, billing.ProjectBudget{
		OrgID:         project.OrganizationID,
		ProjectID:     project.ID,
		LimitCents:    100,
		ReservedCents: 90,
	})
	_, err = apiWorkflowService.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID:     project.OrganizationID,
		ProjectID:          project.ID,
		WorkflowType:       "asset.import",
		ResourceID:         "batch-budget-1",
		Provider:           "seedance",
		IdempotencyKey:     "idem-budget-blocked",
		EstimatedCostCents: 20,
	})
	if err == nil || !strings.Contains(err.Error(), "budget exceeded") {
		t.Fatalf("expected budget exceeded error, got %v", err)
	}

	createUploadResponse := performUploadRequest(t, server, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    project.OrganizationID,
		"project_id":         project.ID,
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 0,
	})
	sessionID := createUploadResponse["session_id"].(string)

	expiredReq, err := http.NewRequest(http.MethodGet, server.URL+"/upload/sessions/"+sessionID, nil)
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	expiredReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))
	expiredResp, err := server.Client().Do(expiredReq)
	if err != nil {
		t.Fatalf("server.Client().Do returned error: %v", err)
	}
	defer expiredResp.Body.Close()
	expiredPayload, err := io.ReadAll(expiredResp.Body)
	if err != nil {
		t.Fatalf("io.ReadAll returned error: %v", err)
	}
	var expiredBody map[string]any
	if err := json.Unmarshal(expiredPayload, &expiredBody); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if got := expiredBody["resume_hint"].(string); !strings.Contains(got, "retry this session") {
		t.Fatalf("expected expired resume hint, got %q", got)
	}

	allEvents := fixture.ListProjectEvents(project.OrganizationID, project.ID)
	if len(allEvents) < 8 {
		t.Fatalf("expected workflow and upload events, got %d", len(allEvents))
	}
	lastEventID := allEvents[0].ID

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+project.OrganizationID+"&project_id="+project.ID, nil)
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	sseReq.Header.Set("Last-Event-ID", lastEventID)
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()
	stream := readReliabilityEventStreamUntil(t, sseResp.Body, cancelSSE, integrationSSEReplayTimeout,
		"event: workflow.updated",
		"event: asset.upload_session.updated",
	)
	if !strings.Contains(stream, "event: workflow.updated") {
		t.Fatalf("expected workflow.updated in replay stream, got %q", stream)
	}
	if !strings.Contains(stream, "event: asset.upload_session.updated") {
		t.Fatalf("expected asset.upload_session.updated in replay stream, got %q", stream)
	}
}

func readReliabilityEventStreamUntil(t *testing.T, body io.ReadCloser, cancel context.CancelFunc, timeout time.Duration, markers ...string) string {
	t.Helper()
	defer cancel()

	if timeout <= 0 {
		timeout = integrationSSEReplayTimeout
	}

	reader := bufio.NewReader(body)
	var stream strings.Builder
	deadline := time.After(timeout)

	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for SSE markers %v in stream %q", markers, stream.String())
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatalf("ReadString returned error before all markers arrived: %v (stream=%q)", err, stream.String())
		}
		stream.WriteString(line)

		current := stream.String()
		allFound := true
		for _, marker := range markers {
			if !strings.Contains(current, marker) {
				allFound = false
				break
			}
		}
		if allFound {
			return current
		}
	}
}

func performUploadRequest(t *testing.T, server *httptest.Server, method string, path string, body any) map[string]any {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	req, err := http.NewRequest(method, server.URL+path, strings.NewReader(string(payload)))
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("server.Client().Do returned error: %v", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("io.ReadAll returned error: %v", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		t.Fatalf("request %s %s returned status %d with body %s", method, path, resp.StatusCode, string(responseBody))
	}

	var response map[string]any
	if err := json.Unmarshal(responseBody, &response); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	return response
}

var _ workflow.WorkflowRun
