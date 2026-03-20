package connect

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

	budget := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.billing.v1.BillingService/UpdateBudgetPolicy", map[string]any{
		"project_id":  project.ID,
		"org_id":      project.OrganizationID,
		"limit_cents": 500,
	}))
	if got := int(budget["limit_cents"].(float64)); got != 500 {
		t.Fatalf("expected limit_cents 500, got %d", got)
	}

	run := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.execution.v1.ExecutionService/StartShotExecutionRun", map[string]any{
		"shot_id":              shot.ID,
		"operator_id":          "user-1",
		"project_id":           project.ID,
		"org_id":               project.OrganizationID,
		"trigger_type":         "manual",
		"estimated_cost_cents": 120,
	}))
	shotExecutionID := run["shot_execution_id"].(string)
	runID := run["id"].(string)

	importBatch := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.asset.v1.AssetService/CreateImportBatch", map[string]any{
		"project_id":  project.ID,
		"org_id":      project.OrganizationID,
		"operator_id": "user-1",
		"source_type": "manual_upload",
	}))

	candidate := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.asset.v1.AssetService/AddCandidateAsset", map[string]any{
		"shot_execution_id": shotExecutionID,
		"project_id":        project.ID,
		"org_id":            project.OrganizationID,
		"import_batch_id":   importBatch["id"].(string),
		"source_run_id":     runID,
		"source_type":       "manual_upload",
		"asset_locale":      "zh-CN",
		"rights_status":     "clear",
		"ai_annotated":      true,
	}))

	executionRecord := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", map[string]any{
		"shot_execution_id": shotExecutionID,
		"asset_id":          candidate["asset_id"].(string),
	}))
	if got := executionRecord["status"].(string); got != "primary_selected" {
		t.Fatalf("expected primary_selected, got %q", got)
	}

	gate := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks", map[string]any{
		"shot_execution_id": shotExecutionID,
	}))
	if failedChecks, ok := gate["failed_checks"].([]any); ok && len(failedChecks) != 0 {
		t.Fatalf("expected no failed checks, got %v", failedChecks)
	}

	evaluationRun := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.review.v1.ReviewService/CreateEvaluationRun", map[string]any{
		"shot_execution_id": shotExecutionID,
		"passed_checks":     gate["passed_checks"],
		"failed_checks":     gate["failed_checks"],
	}))
	if got := evaluationRun["status"].(string); got != "passed" {
		t.Fatalf("expected evaluation status passed, got %q", got)
	}

	submitted := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.execution.v1.ExecutionService/SubmitShotForReview", map[string]any{
		"shot_execution_id": shotExecutionID,
	}))
	if got := submitted["status"].(string); got != "submitted_for_review" {
		t.Fatalf("expected submitted_for_review, got %q", got)
	}

	review := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodPost, "/connect/hualala.review.v1.ReviewService/CreateShotReview", map[string]any{
		"shot_execution_id": shotExecutionID,
		"conclusion":        "approved",
		"comment_locale":    "zh-CN",
		"comment":           "可以通过",
	}))
	if got := review["conclusion"].(string); got != "approved" {
		t.Fatalf("expected approved review, got %q", got)
	}

	summary := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodGet, "/connect/hualala.review.v1.ReviewService/GetShotReviewSummary?shot_execution_id="+shotExecutionID, nil))
	if got := summary["latest_conclusion"].(string); got != "approved" {
		t.Fatalf("expected latest_conclusion approved, got %q", got)
	}

	budgetSnapshot := decodeJSONResponse[map[string]any](t, performJSONRequest(t, mux, http.MethodGet, "/connect/hualala.billing.v1.BillingService/GetBudgetSnapshot?project_id="+project.ID, nil))
	if got := int(budgetSnapshot["remaining_budget_cents"].(float64)); got != 380 {
		t.Fatalf("expected remaining_budget_cents 380, got %d", got)
	}
}

func performJSONRequest(t *testing.T, mux *http.ServeMux, method string, target string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("json.Marshal returned error: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(method, target, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code >= 400 {
		t.Fatalf("request %s %s returned status %d with body %s", method, target, rec.Code, rec.Body.String())
	}
	return rec
}

func decodeJSONResponse[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()

	var response T
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	return response
}
