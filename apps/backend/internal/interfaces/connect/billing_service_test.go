package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connectrpc "connectrpc.com/connect"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestBillingObservabilityAfterShotRun(t *testing.T) {
	ctx := context.Background()
	client, projectID, shotExecutionID, runID := seedBillingObservabilityScenario(t)

	usageRecords, err := client.ListUsageRecords(ctx, connectrpc.NewRequest(&billingv1.ListUsageRecordsRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("ListUsageRecords returned error: %v", err)
	}
	if len(usageRecords.Msg.GetUsageRecords()) != 1 {
		t.Fatalf("expected 1 usage record, got %d", len(usageRecords.Msg.GetUsageRecords()))
	}
	usageRecord := usageRecords.Msg.GetUsageRecords()[0]
	if got := usageRecord.GetProjectId(); got != projectID {
		t.Fatalf("expected usage record project_id %q, got %q", projectID, got)
	}
	if got := usageRecord.GetShotExecutionId(); got != shotExecutionID {
		t.Fatalf("expected usage record shot_execution_id %q, got %q", shotExecutionID, got)
	}
	if got := usageRecord.GetShotExecutionRunId(); got != runID {
		t.Fatalf("expected usage record shot_execution_run_id %q, got %q", runID, got)
	}
	if got := usageRecord.GetMeter(); got != "shot_execution_run" {
		t.Fatalf("expected usage record meter %q, got %q", "shot_execution_run", got)
	}
	if got := usageRecord.GetAmountCents(); got != 120 {
		t.Fatalf("expected usage record amount_cents 120, got %d", got)
	}

	billingEvents, err := client.ListBillingEvents(ctx, connectrpc.NewRequest(&billingv1.ListBillingEventsRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("ListBillingEvents returned error: %v", err)
	}
	if len(billingEvents.Msg.GetBillingEvents()) != 1 {
		t.Fatalf("expected 1 billing event, got %d", len(billingEvents.Msg.GetBillingEvents()))
	}
	billingEvent := billingEvents.Msg.GetBillingEvents()[0]
	if got := billingEvent.GetProjectId(); got != projectID {
		t.Fatalf("expected billing event project_id %q, got %q", projectID, got)
	}
	if got := billingEvent.GetShotExecutionId(); got != shotExecutionID {
		t.Fatalf("expected billing event shot_execution_id %q, got %q", shotExecutionID, got)
	}
	if got := billingEvent.GetShotExecutionRunId(); got != runID {
		t.Fatalf("expected billing event shot_execution_run_id %q, got %q", runID, got)
	}
	if got := billingEvent.GetEventType(); got != "execution_reserved" {
		t.Fatalf("expected billing event event_type %q, got %q", "execution_reserved", got)
	}
	if got := billingEvent.GetAmountCents(); got != 120 {
		t.Fatalf("expected billing event amount_cents 120, got %d", got)
	}

	budgetSnapshot, err := client.GetBudgetSnapshot(ctx, connectrpc.NewRequest(&billingv1.GetBudgetSnapshotRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("GetBudgetSnapshot returned error: %v", err)
	}
	snapshot := budgetSnapshot.Msg.GetBudgetSnapshot()
	if got := snapshot.GetProjectId(); got != projectID {
		t.Fatalf("expected budget snapshot project_id %q, got %q", projectID, got)
	}
	if got := snapshot.GetLimitCents(); got != 500 {
		t.Fatalf("expected budget snapshot limit_cents 500, got %d", got)
	}
	if got := snapshot.GetReservedCents(); got != 120 {
		t.Fatalf("expected budget snapshot reserved_cents 120, got %d", got)
	}
	if got := snapshot.GetRemainingBudgetCents(); got != 380 {
		t.Fatalf("expected budget snapshot remaining_budget_cents 380, got %d", got)
	}
}

func seedBillingObservabilityScenario(t *testing.T) (billingv1connect.BillingServiceClient, string, string, string) {
	t.Helper()

	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Billing Observability",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN", "en-US"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	episode, err := projectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}

	scene, err := contentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "开场",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}

	shot, err := contentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "主角入场",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	_, err = contentService.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       shot.ID,
		ContentLocale: "zh-CN",
		Body:          "主角推门进入客厅。",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	billingClient := billingv1connect.NewBillingServiceClient(server.Client(), server.URL)
	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)

	_, err = billingClient.UpdateBudgetPolicy(ctx, connectrpc.NewRequest(&billingv1.UpdateBudgetPolicyRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		LimitCents: 500,
	}))
	if err != nil {
		t.Fatalf("UpdateBudgetPolicy returned error: %v", err)
	}

	run, err := executionClient.StartShotExecutionRun(ctx, connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:             shot.ID,
		OperatorId:         "user-1",
		ProjectId:          project.ID,
		OrgId:              project.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: 120,
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}

	return billingClient, project.ID, run.Msg.GetRun().GetShotExecutionId(), run.Msg.GetRun().GetId()
}
