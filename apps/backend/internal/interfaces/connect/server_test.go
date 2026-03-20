package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connectrpc "connectrpc.com/connect"
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	billingv1connect "github.com/hualala/apps/backend/gen/hualala/billing/v1/billingv1connect"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	executionv1connect "github.com/hualala/apps/backend/gen/hualala/execution/v1/executionv1connect"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	reviewv1connect "github.com/hualala/apps/backend/gen/hualala/review/v1/reviewv1connect"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestRegisterRoutes(t *testing.T) {
	mux := http.NewServeMux()
	RegisterRoutes(mux, RouteDependencies{})

	testCases := []struct {
		name           string
		method         string
		target         string
		expectedStatus int
	}{
		{
			name:           "healthz route is available",
			method:         http.MethodGet,
			target:         "/healthz",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "sse route placeholder is available",
			method:         http.MethodGet,
			target:         "/sse/events",
			expectedStatus: http.StatusNotImplemented,
		},
		{
			name:           "upload session route placeholder is available",
			method:         http.MethodPost,
			target:         "/upload/sessions",
			expectedStatus: http.StatusNotImplemented,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.target, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Fatalf("expected status %d, got %d", tc.expectedStatus, rec.Code)
			}
		})
	}
}

func TestExecutionAssetReviewBillingRoutes(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Connect API",
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
	RegisterRoutes(mux, NewRouteDependencies(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(server.Client(), server.URL)
	billingClient := billingv1connect.NewBillingServiceClient(server.Client(), server.URL)

	budget, err := billingClient.UpdateBudgetPolicy(ctx, connectrpc.NewRequest(&billingv1.UpdateBudgetPolicyRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		LimitCents: 500,
	}))
	if err != nil {
		t.Fatalf("UpdateBudgetPolicy returned error: %v", err)
	}
	if got := budget.Msg.GetBudgetPolicy().GetLimitCents(); got != 500 {
		t.Fatalf("expected limit_cents 500, got %d", got)
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
	shotExecutionID := run.Msg.GetRun().GetShotExecutionId()
	runID := run.Msg.GetRun().GetId()

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
		SourceRunId:     runID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AiAnnotated:     true,
	}))
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	importItemsBeforeConfirm, err := assetClient.ListImportBatchItems(ctx, connectrpc.NewRequest(&assetv1.ListImportBatchItemsRequest{
		ImportBatchId: importBatch.Msg.GetImportBatch().GetId(),
	}))
	if err != nil {
		t.Fatalf("ListImportBatchItems returned error: %v", err)
	}
	if len(importItemsBeforeConfirm.Msg.GetItems()) != 1 {
		t.Fatalf("expected 1 import batch item, got %d", len(importItemsBeforeConfirm.Msg.GetItems()))
	}
	if got := importItemsBeforeConfirm.Msg.GetItems()[0].GetMatchedShotId(); got != shot.ID {
		t.Fatalf("expected matched_shot_id %q, got %q", shot.ID, got)
	}
	if got := importItemsBeforeConfirm.Msg.GetItems()[0].GetStatus(); got != "matched_pending_confirm" {
		t.Fatalf("expected matched_pending_confirm, got %q", got)
	}

	importItemsAfterConfirm, err := assetClient.BatchConfirmImportBatchItems(ctx, connectrpc.NewRequest(&assetv1.BatchConfirmImportBatchItemsRequest{
		ImportBatchId: importBatch.Msg.GetImportBatch().GetId(),
		ItemIds:       []string{importItemsBeforeConfirm.Msg.GetItems()[0].GetId()},
	}))
	if err != nil {
		t.Fatalf("BatchConfirmImportBatchItems returned error: %v", err)
	}
	if len(importItemsAfterConfirm.Msg.GetItems()) != 1 {
		t.Fatalf("expected 1 confirmed import batch item, got %d", len(importItemsAfterConfirm.Msg.GetItems()))
	}
	if got := importItemsAfterConfirm.Msg.GetItems()[0].GetStatus(); got != "confirmed" {
		t.Fatalf("expected confirmed import batch item, got %q", got)
	}

	executionRecord, err := executionClient.SelectPrimaryAsset(ctx, connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         candidate.Msg.GetAsset().GetAssetId(),
	}))
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	if got := executionRecord.Msg.GetShotExecution().GetStatus(); got != "primary_selected" {
		t.Fatalf("expected primary_selected, got %q", got)
	}

	gate, err := executionClient.RunSubmissionGateChecks(ctx, connectrpc.NewRequest(&executionv1.RunSubmissionGateChecksRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}
	if len(gate.Msg.GetFailedChecks()) != 0 {
		t.Fatalf("expected no failed checks, got %v", gate.Msg.GetFailedChecks())
	}

	evaluationRun, err := reviewClient.CreateEvaluationRun(ctx, connectrpc.NewRequest(&reviewv1.CreateEvaluationRunRequest{
		ShotExecutionId: shotExecutionID,
		PassedChecks:    gate.Msg.GetPassedChecks(),
		FailedChecks:    gate.Msg.GetFailedChecks(),
	}))
	if err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}
	if got := evaluationRun.Msg.GetEvaluationRun().GetStatus(); got != "passed" {
		t.Fatalf("expected evaluation status passed, got %q", got)
	}

	submitted, err := executionClient.SubmitShotForReview(ctx, connectrpc.NewRequest(&executionv1.SubmitShotForReviewRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("SubmitShotForReview returned error: %v", err)
	}
	if got := submitted.Msg.GetShotExecution().GetStatus(); got != "submitted_for_review" {
		t.Fatalf("expected submitted_for_review, got %q", got)
	}

	review, err := reviewClient.CreateShotReview(ctx, connectrpc.NewRequest(&reviewv1.CreateShotReviewRequest{
		ShotExecutionId: shotExecutionID,
		Conclusion:      "approved",
		CommentLocale:   "zh-CN",
		Comment:         "可以通过",
	}))
	if err != nil {
		t.Fatalf("CreateShotReview returned error: %v", err)
	}
	if got := review.Msg.GetShotReview().GetConclusion(); got != "approved" {
		t.Fatalf("expected approved review, got %q", got)
	}

	summary, err := reviewClient.GetShotReviewSummary(ctx, connectrpc.NewRequest(&reviewv1.GetShotReviewSummaryRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("GetShotReviewSummary returned error: %v", err)
	}
	if got := summary.Msg.GetSummary().GetLatestConclusion(); got != "approved" {
		t.Fatalf("expected latest_conclusion approved, got %q", got)
	}

	budgetSnapshot, err := billingClient.GetBudgetSnapshot(ctx, connectrpc.NewRequest(&billingv1.GetBudgetSnapshotRequest{
		ProjectId: project.ID,
	}))
	if err != nil {
		t.Fatalf("GetBudgetSnapshot returned error: %v", err)
	}
	if got := budgetSnapshot.Msg.GetBudgetSnapshot().GetRemainingBudgetCents(); got != 380 {
		t.Fatalf("expected remaining_budget_cents 380, got %d", got)
	}
}
