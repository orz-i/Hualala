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
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestMarkShotReworkRequiredPublishesShotExecutionUpdated(t *testing.T) {
	ctx := context.Background()
	scenario := seedConnectShotExecutionReworkScenario(t, "Rework Event Project")

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, scenario.Server.URL+"/sse/events?organization_id="+scenario.OrganizationID+"&project_id="+scenario.ProjectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
	sseResp, err := scenario.Server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()

	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseResp.StatusCode)
	}

	if _, err := scenario.ReviewClient.CreateShotReview(ctx, connectrpc.NewRequest(&reviewv1.CreateShotReviewRequest{
		ShotExecutionId: scenario.ShotExecutionID,
		Conclusion:      "rejected",
		CommentLocale:   "zh-CN",
		Comment:         "镜头节奏需要调整",
	})); err != nil {
		t.Fatalf("CreateShotReview returned error: %v", err)
	}
	reworked, err := scenario.ExecutionClient.MarkShotReworkRequired(ctx, connectrpc.NewRequest(&executionv1.MarkShotReworkRequiredRequest{
		ShotExecutionId: scenario.ShotExecutionID,
		Reason:          "镜头节奏需要调整",
	}))
	if err != nil {
		t.Fatalf("MarkShotReworkRequired returned error: %v", err)
	}
	if got := reworked.Msg.GetShotExecution().GetStatus(); got != "rework_required" {
		t.Fatalf("expected rework_required, got %q", got)
	}

	body := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: shot.review.created",
		`"conclusion":"rejected"`,
		"event: shot.execution.updated",
		`"status":"rework_required"`,
		`"reason":"镜头节奏需要调整"`,
	)
	if !strings.Contains(body, `"status":"rework_required"`) {
		t.Fatalf("expected rework_required SSE payload, got body %q", body)
	}
	if !strings.Contains(body, `"reason":"镜头节奏需要调整"`) {
		t.Fatalf("expected rework reason SSE payload, got body %q", body)
	}
}

func TestAddCandidateAssetPublishesShotExecutionUpdated(t *testing.T) {
	ctx := context.Background()
	scenario := seedConnectImportWorkbenchScenario(t, "Import Workbench Events")

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, scenario.Server.URL+"/sse/events?organization_id="+scenario.OrganizationID+"&project_id="+scenario.ProjectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
	sseResp, err := scenario.Server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()

	candidate, err := scenario.AssetClient.AddCandidateAsset(ctx, connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: scenario.ShotExecutionID,
		ProjectId:       scenario.ProjectID,
		OrgId:           scenario.OrganizationID,
		ImportBatchId:   scenario.ImportBatchID,
		SourceRunId:     scenario.RunID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	body := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: shot.execution.updated",
		`"shot_execution_id":"`+scenario.ShotExecutionID+`"`,
		`"status":"candidate_ready"`,
		`"current_run_id":"`+scenario.RunID+`"`,
		`"candidate_asset_id":"`+candidate.Msg.GetAsset().GetId()+`"`,
		`"asset_id":"`+candidate.Msg.GetAsset().GetAssetId()+`"`,
	)
	if !strings.Contains(body, `"status":"candidate_ready"`) {
		t.Fatalf("expected candidate_ready SSE payload, got body %q", body)
	}
}

func TestAddCandidateAssetRejectsScopeMismatch(t *testing.T) {
	ctx := context.Background()
	scenario := seedConnectImportWorkbenchScenario(t, "Import Workbench Scope Mismatch")

	_, err := scenario.AssetClient.AddCandidateAsset(ctx, connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: scenario.ShotExecutionID,
		ProjectId:       "project-other",
		OrgId:           scenario.OrganizationID,
		ImportBatchId:   scenario.ImportBatchID,
		SourceRunId:     scenario.RunID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err == nil {
		t.Fatal("expected scope mismatch error")
	}

	var connectErr *connectrpc.Error
	if !errors.As(err, &connectErr) {
		t.Fatalf("expected connect error, got %T: %v", err, err)
	}
	if got := connectErr.Code(); got != connectrpc.CodePermissionDenied {
		t.Fatalf("expected permission denied code, got %v", got)
	}

	workbench, workbenchErr := scenario.AssetClient.GetImportBatchWorkbench(ctx, connectrpc.NewRequest(&assetv1.GetImportBatchWorkbenchRequest{
		ImportBatchId: scenario.ImportBatchID,
	}))
	if workbenchErr != nil {
		t.Fatalf("GetImportBatchWorkbench returned error: %v", workbenchErr)
	}
	if len(workbench.Msg.GetCandidateAssets()) != 0 {
		t.Fatalf("expected no candidate assets after scope mismatch, got %d", len(workbench.Msg.GetCandidateAssets()))
	}
	if len(workbench.Msg.GetItems()) != 0 {
		t.Fatalf("expected no import batch items after scope mismatch, got %d", len(workbench.Msg.GetItems()))
	}
	if got := workbench.Msg.GetImportBatch().GetStatus(); got != "pending_review" {
		t.Fatalf("expected import batch status pending_review after scope mismatch, got %q", got)
	}
}

func TestAssetServiceWritesPublishImportBatchProjectEvents(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Asset Events",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
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
		Title:   "镜头一",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)

	run, err := executionClient.StartShotExecutionRun(ctx, connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:      shot.ID,
		OperatorId:  "user-1",
		ProjectId:   project.ID,
		OrgId:       project.OrganizationID,
		TriggerType: "manual",
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	shotExecutionID := run.Msg.GetRun().GetShotExecutionId()

	importBatch, err := assetClient.CreateImportBatch(ctx, connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		OperatorId: "user-1",
		SourceType: "manual_upload",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}
	importBatchID := importBatch.Msg.GetImportBatch().GetId()

	candidate, err := assetClient.AddCandidateAsset(ctx, connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: shotExecutionID,
		ProjectId:       project.ID,
		OrgId:           project.OrganizationID,
		ImportBatchId:   importBatchID,
		SourceRunId:     run.Msg.GetRun().GetId(),
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	items, err := assetClient.ListImportBatchItems(ctx, connectrpc.NewRequest(&assetv1.ListImportBatchItemsRequest{
		ImportBatchId: importBatchID,
	}))
	if err != nil {
		t.Fatalf("ListImportBatchItems returned error: %v", err)
	}
	if _, err := assetClient.BatchConfirmImportBatchItems(ctx, connectrpc.NewRequest(&assetv1.BatchConfirmImportBatchItemsRequest{
		ImportBatchId: importBatchID,
		ItemIds:       []string{items.Msg.GetItems()[0].GetId()},
	})); err != nil {
		t.Fatalf("BatchConfirmImportBatchItems returned error: %v", err)
	}

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+project.OrganizationID+"&project_id="+project.ID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()

	body := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: asset.import_batch.updated",
		`"import_batch_id":"`+importBatchID+`"`,
		`"status":"confirmed"`,
		`"candidate_asset_id":"`+candidate.Msg.GetAsset().GetId()+`"`,
		`"reason":"import_batch.confirmed"`,
	)
	if !strings.Contains(body, "event: asset.import_batch.updated") {
		t.Fatalf("expected asset.import_batch.updated SSE event, got body %q", body)
	}
}
