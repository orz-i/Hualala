package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connectrpc "connectrpc.com/connect"
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestGetShotWorkbenchIncludesCandidateAndReviewSummary(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store, store.Publisher())

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Shot Workbench",
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
	defer server.Close()

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(server.Client(), server.URL)

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

	candidate, err := assetClient.AddCandidateAsset(ctx, connectrpc.NewRequest(&assetv1.AddCandidateAssetRequest{
		ShotExecutionId: shotExecutionID,
		ProjectId:       project.ID,
		OrgId:           project.OrganizationID,
		ImportBatchId:   importBatch.Msg.GetImportBatch().GetId(),
		SourceRunId:     run.Msg.GetRun().GetId(),
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		ConsentStatus:   "granted",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	_, err = executionClient.SelectPrimaryAsset(ctx, connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         candidate.Msg.GetAsset().GetAssetId(),
	}))
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}

	gate, err := executionClient.RunSubmissionGateChecks(ctx, connectrpc.NewRequest(&executionv1.RunSubmissionGateChecksRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}

	evaluationRun, err := reviewClient.CreateEvaluationRun(ctx, connectrpc.NewRequest(&reviewv1.CreateEvaluationRunRequest{
		ShotExecutionId: shotExecutionID,
		PassedChecks:    gate.Msg.GetPassedChecks(),
		FailedChecks:    gate.Msg.GetFailedChecks(),
	}))
	if err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}

	_, err = reviewClient.CreateShotReview(ctx, connectrpc.NewRequest(&reviewv1.CreateShotReviewRequest{
		ShotExecutionId: shotExecutionID,
		Conclusion:      "approved",
		CommentLocale:   "zh-CN",
		Comment:         "可以通过",
	}))
	if err != nil {
		t.Fatalf("CreateShotReview returned error: %v", err)
	}

	workbench, err := executionClient.GetShotWorkbench(ctx, connectrpc.NewRequest(&executionv1.GetShotWorkbenchRequest{
		ShotId: shot.ID,
	}))
	if err != nil {
		t.Fatalf("GetShotWorkbench returned error: %v", err)
	}
	if len(workbench.Msg.GetWorkbench().GetCandidateAssets()) != 1 {
		t.Fatalf("expected 1 candidate asset, got %d", len(workbench.Msg.GetWorkbench().GetCandidateAssets()))
	}
	if got := workbench.Msg.GetWorkbench().GetCandidateAssets()[0].GetId(); got != candidate.Msg.GetAsset().GetId() {
		t.Fatalf("expected candidate asset %q, got %q", candidate.Msg.GetAsset().GetId(), got)
	}
	if got := workbench.Msg.GetWorkbench().GetReviewSummary().GetLatestConclusion(); got != "approved" {
		t.Fatalf("expected latest conclusion approved, got %q", got)
	}
	if got := workbench.Msg.GetWorkbench().GetLatestEvaluationRun().GetId(); got != evaluationRun.Msg.GetEvaluationRun().GetId() {
		t.Fatalf("expected latest evaluation run %q, got %q", evaluationRun.Msg.GetEvaluationRun().GetId(), got)
	}
	if got := workbench.Msg.GetWorkbench().GetLatestEvaluationRun().GetStatus(); got != "passed" {
		t.Fatalf("expected latest evaluation status passed, got %q", got)
	}
}
