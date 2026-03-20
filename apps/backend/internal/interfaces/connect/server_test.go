package connect

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

func TestRegisterRoutes(t *testing.T) {
	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(db.NewMemoryStore()))

	testCases := []struct {
		name           string
		method         string
		target         string
		body           []byte
		contentType    string
		expectedStatus int
	}{
		{
			name:           "healthz route is available",
			method:         http.MethodGet,
			target:         "/healthz",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "sse route is available",
			method:         http.MethodGet,
			target:         "/sse/events",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "upload session route is available",
			method:         http.MethodPost,
			target:         "/upload/sessions",
			body:           []byte(`{"organization_id":"org-1","project_id":"project-1","file_name":"shot.png","checksum":"sha256:abc123","size_bytes":1024,"expires_in_seconds":1}`),
			contentType:    "application/json",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.target == "/sse/events" {
				server := httptest.NewServer(mux)
				defer server.Close()
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				req, err := http.NewRequestWithContext(ctx, tc.method, server.URL+tc.target, bytes.NewReader(tc.body))
				if err != nil {
					t.Fatalf("http.NewRequestWithContext returned error: %v", err)
				}
				if tc.contentType != "" {
					req.Header.Set("Content-Type", tc.contentType)
				}
				resp, err := server.Client().Do(req)
				if err != nil {
					t.Fatalf("server.Client().Do returned error: %v", err)
				}
				defer resp.Body.Close()
				if resp.StatusCode != tc.expectedStatus {
					t.Fatalf("expected status %d, got %d", tc.expectedStatus, resp.StatusCode)
				}
				return
			}

			req := httptest.NewRequest(tc.method, tc.target, bytes.NewReader(tc.body))
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
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
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
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
	if got := importItemsBeforeConfirm.Msg.GetItems()[0].GetAssetId(); got != candidate.Msg.GetAsset().GetAssetId() {
		t.Fatalf("expected import batch item asset_id %q, got %q", candidate.Msg.GetAsset().GetAssetId(), got)
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
	if got := importItemsAfterConfirm.Msg.GetItems()[0].GetAssetId(); got != candidate.Msg.GetAsset().GetAssetId() {
		t.Fatalf("expected confirmed import batch item asset_id %q, got %q", candidate.Msg.GetAsset().GetAssetId(), got)
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

	sseReq, err := http.NewRequest(http.MethodGet, server.URL+"/sse/events?organization_id="+project.OrganizationID+"&project_id="+project.ID, nil)
	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err = http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+project.OrganizationID+"&project_id="+project.ID, nil)
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()

	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseResp.StatusCode)
	}
	if got := sseResp.Header.Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected SSE content type, got %q", got)
	}

	body := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: shot.execution.updated",
		`"status":"submitted_for_review"`,
		"event: shot.review.created",
		`"conclusion":"approved"`,
	)
	if !strings.Contains(body, "event: shot.execution.updated") {
		t.Fatalf("expected execution SSE event, got body %q", body)
	}
	if !strings.Contains(body, `"status":"submitted_for_review"`) {
		t.Fatalf("expected submitted_for_review SSE payload, got body %q", body)
	}
	if !strings.Contains(body, "event: shot.review.created") {
		t.Fatalf("expected review SSE event, got body %q", body)
	}
	if !strings.Contains(body, `"conclusion":"approved"`) {
		t.Fatalf("expected approved review SSE payload, got body %q", body)
	}
}

func readEventStreamUntil(t *testing.T, body io.ReadCloser, cancel context.CancelFunc, markers ...string) string {
	t.Helper()
	defer cancel()

	reader := bufio.NewReader(body)
	var stream strings.Builder
	deadline := time.After(2 * time.Second)

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

func TestImportBatchWorkbenchIncludesUploadArtifacts(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Upload Workbench",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN", "en-US"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)

	importBatch, err := assetClient.CreateImportBatch(ctx, connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		OperatorId: "user-1",
		SourceType: "upload_session",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}
	importBatchID := importBatch.Msg.GetImportBatch().GetId()

	createResp := performConnectUploadJSONRequest(t, server, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    project.OrganizationID,
		"project_id":         project.ID,
		"import_batch_id":    importBatchID,
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	sessionID := createResp["session_id"].(string)

	completeResp := performConnectUploadJSONRequest(t, server, http.MethodPost, "/upload/sessions/"+sessionID+"/complete", map[string]any{
		"variant_type":  "original",
		"mime_type":     "image/png",
		"locale":        "zh-CN",
		"rights_status": "clear",
		"ai_annotated":  true,
		"width":         1920,
		"height":        1080,
	})
	assetID := completeResp["asset_id"].(string)
	uploadFileID := completeResp["upload_file_id"].(string)
	variantID := completeResp["variant_id"].(string)

	workbench, err := assetClient.GetImportBatchWorkbench(ctx, connectrpc.NewRequest(&assetv1.GetImportBatchWorkbenchRequest{
		ImportBatchId: importBatchID,
	}))
	if err != nil {
		t.Fatalf("GetImportBatchWorkbench returned error: %v", err)
	}
	if got := workbench.Msg.GetImportBatch().GetId(); got != importBatchID {
		t.Fatalf("expected import batch %q, got %q", importBatchID, got)
	}
	if len(workbench.Msg.GetUploadSessions()) != 1 {
		t.Fatalf("expected 1 upload session, got %d", len(workbench.Msg.GetUploadSessions()))
	}
	if got := workbench.Msg.GetUploadSessions()[0].GetId(); got != sessionID {
		t.Fatalf("expected upload session %q, got %q", sessionID, got)
	}
	if len(workbench.Msg.GetUploadFiles()) != 1 {
		t.Fatalf("expected 1 upload file, got %d", len(workbench.Msg.GetUploadFiles()))
	}
	if got := workbench.Msg.GetUploadFiles()[0].GetId(); got != uploadFileID {
		t.Fatalf("expected upload file %q, got %q", uploadFileID, got)
	}
	if len(workbench.Msg.GetMediaAssetVariants()) != 1 {
		t.Fatalf("expected 1 media asset variant, got %d", len(workbench.Msg.GetMediaAssetVariants()))
	}
	if got := workbench.Msg.GetMediaAssetVariants()[0].GetId(); got != variantID {
		t.Fatalf("expected media asset variant %q, got %q", variantID, got)
	}
	if len(workbench.Msg.GetMediaAssets()) != 1 {
		t.Fatalf("expected 1 media asset, got %d", len(workbench.Msg.GetMediaAssets()))
	}
	if got := workbench.Msg.GetMediaAssets()[0].GetId(); got != assetID {
		t.Fatalf("expected media asset %q, got %q", assetID, got)
	}
	if len(workbench.Msg.GetItems()) != 1 {
		t.Fatalf("expected 1 import batch item, got %d", len(workbench.Msg.GetItems()))
	}
	if got := workbench.Msg.GetItems()[0].GetAssetId(); got != assetID {
		t.Fatalf("expected import batch item asset_id %q, got %q", assetID, got)
	}
}

func TestImportBatchWorkbenchIncludesShotExecutionState(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Import Workbench Execution",
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

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)

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
		SourceType: "upload_session",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}
	importBatchID := importBatch.Msg.GetImportBatch().GetId()

	createResp := performConnectUploadJSONRequest(t, server, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    project.OrganizationID,
		"project_id":         project.ID,
		"import_batch_id":    importBatchID,
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	sessionID := createResp["session_id"].(string)

	completeResp := performConnectUploadJSONRequest(t, server, http.MethodPost, "/upload/sessions/"+sessionID+"/complete", map[string]any{
		"shot_execution_id": shotExecutionID,
		"variant_type":      "original",
		"mime_type":         "image/png",
		"locale":            "zh-CN",
		"rights_status":     "clear",
		"ai_annotated":      true,
		"width":             1920,
		"height":            1080,
	})
	assetID := completeResp["asset_id"].(string)

	_, err = executionClient.SelectPrimaryAsset(ctx, connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         assetID,
	}))
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}

	workbench, err := assetClient.GetImportBatchWorkbench(ctx, connectrpc.NewRequest(&assetv1.GetImportBatchWorkbenchRequest{
		ImportBatchId: importBatchID,
	}))
	if err != nil {
		t.Fatalf("GetImportBatchWorkbench returned error: %v", err)
	}
	if len(workbench.Msg.GetShotExecutions()) != 1 {
		t.Fatalf("expected 1 shot execution, got %d", len(workbench.Msg.GetShotExecutions()))
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetId(); got != shotExecutionID {
		t.Fatalf("expected shot execution %q, got %q", shotExecutionID, got)
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetStatus(); got != "primary_selected" {
		t.Fatalf("expected shot execution status primary_selected, got %q", got)
	}
	if got := workbench.Msg.GetShotExecutions()[0].GetPrimaryAssetId(); got != assetID {
		t.Fatalf("expected primary_asset_id %q, got %q", assetID, got)
	}
}

func TestGetShotWorkbenchIncludesCandidateAndReviewSummary(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)

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

func performConnectUploadJSONRequest(t *testing.T, server *httptest.Server, method string, path string, body any) map[string]any {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	req, err := http.NewRequest(method, server.URL+path, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("http.NewRequest returned error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("server.Client().Do returned error: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("io.ReadAll returned error: %v", err)
	}
	if resp.StatusCode >= 400 {
		t.Fatalf("request %s %s returned status %d with body %s", method, path, resp.StatusCode, string(bodyBytes))
	}

	var response map[string]any
	if err := json.Unmarshal(bodyBytes, &response); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	return response
}

func TestServerRouteDependenciesDoNotExposeRawMemoryStore(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("server.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	text := string(content)
	if strings.Contains(text, "Store            *db.MemoryStore") || strings.Contains(text, "Store *db.MemoryStore") {
		t.Fatalf("expected RouteDependencies to avoid raw *db.MemoryStore field")
	}
	if strings.Contains(text, "type RuntimeDependencies struct") {
		t.Fatalf("expected connect package to avoid RuntimeDependencies composition root")
	}
	if strings.Contains(text, "NewRuntimeDependenciesFromStore") {
		t.Fatalf("expected connect package to avoid NewRuntimeDependenciesFromStore")
	}
}

func TestCmdAPIAvoidsRepositorySetConstruction(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "..", "cmd", "api", "main.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	text := string(content)
	if strings.Contains(text, "runtime.NewRepositorySet(") {
		t.Fatalf("expected cmd/api to construct runtime dependencies via factory, not runtime.NewRepositorySet")
	}
	if strings.Contains(text, "*db.MemoryStore") {
		t.Fatalf("expected cmd/api to avoid raw *db.MemoryStore dependency")
	}
}

func newRouteDependenciesFromStore(store *db.MemoryStore) RouteDependencies {
	return NewRouteDependencies(runtime.NewFactory(store).Services())
}
