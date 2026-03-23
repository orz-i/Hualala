package connect

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
	authdomain "github.com/hualala/apps/backend/internal/domain/auth"
	orgdomain "github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

const (
	connectTestOrgID  = "org-1"
	connectTestUserID = "user-1"
)

type connectShotExecutionReworkScenario struct {
	Server          *httptest.Server
	ProjectID       string
	OrganizationID  string
	ShotExecutionID string
	ExecutionClient executionv1connect.ExecutionServiceClient
	ReviewClient    reviewv1connect.ReviewServiceClient
}

func seedConnectShotExecutionReworkScenario(t *testing.T, title string) connectShotExecutionReworkScenario {
	t.Helper()

	ctx := context.Background()
	store := db.NewMemoryStore()
	seedConnectAuthStore(store)
	services := runtime.NewFactory(store).Services()

	project, err := services.ProjectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          connectTestOrgID,
		OwnerUserID:             connectTestUserID,
		Title:                   title,
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	episode, err := services.ProjectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}
	scene, err := services.ContentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "返工场景",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}
	shot, err := services.ContentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "返工镜头",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}
	if _, err := services.ContentService.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       shot.ID,
		ContentLocale: "zh-CN",
		Body:          "主角重新调整镜头节奏。",
	}); err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(services))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)
	reviewClient := reviewv1connect.NewReviewServiceClient(server.Client(), server.URL)
	billingClient := billingv1connect.NewBillingServiceClient(server.Client(), server.URL)

	if _, err := billingClient.UpdateBudgetPolicy(ctx, connectrpc.NewRequest(&billingv1.UpdateBudgetPolicyRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		LimitCents: 500,
	})); err != nil {
		t.Fatalf("UpdateBudgetPolicy returned error: %v", err)
	}

	run, err := executionClient.StartShotExecutionRun(ctx, connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:             shot.ID,
		OperatorId:         connectTestUserID,
		ProjectId:          project.ID,
		OrgId:              project.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: 120,
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	shotExecutionID := run.Msg.GetRun().GetShotExecutionId()

	importBatch, err := assetClient.CreateImportBatch(ctx, connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		OperatorId: connectTestUserID,
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
	if _, err := executionClient.SelectPrimaryAsset(ctx, connectrpc.NewRequest(&executionv1.SelectPrimaryAssetRequest{
		ShotExecutionId: shotExecutionID,
		AssetId:         candidate.Msg.GetAsset().GetAssetId(),
	})); err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	gate, err := executionClient.RunSubmissionGateChecks(ctx, connectrpc.NewRequest(&executionv1.RunSubmissionGateChecksRequest{
		ShotExecutionId: shotExecutionID,
	}))
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}
	if _, err := reviewClient.CreateEvaluationRun(ctx, connectrpc.NewRequest(&reviewv1.CreateEvaluationRunRequest{
		ShotExecutionId: shotExecutionID,
		PassedChecks:    gate.Msg.GetPassedChecks(),
		FailedChecks:    gate.Msg.GetFailedChecks(),
	})); err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}
	if _, err := executionClient.SubmitShotForReview(ctx, connectrpc.NewRequest(&executionv1.SubmitShotForReviewRequest{
		ShotExecutionId: shotExecutionID,
	})); err != nil {
		t.Fatalf("SubmitShotForReview returned error: %v", err)
	}

	return connectShotExecutionReworkScenario{
		Server:          server,
		ProjectID:       project.ID,
		OrganizationID:  project.OrganizationID,
		ShotExecutionID: shotExecutionID,
		ExecutionClient: executionClient,
		ReviewClient:    reviewClient,
	}
}

func readEventStreamUntil(t *testing.T, body io.ReadCloser, cancel context.CancelFunc, markers ...string) string {
	t.Helper()
	defer cancel()

	reader := bufio.NewReader(body)
	var stream strings.Builder
	done := make(chan struct{})
	defer close(done)

	lineCh := make(chan string, 1)
	errCh := make(chan error, 1)

	go func() {
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				select {
				case errCh <- err:
				case <-done:
				}
				return
			}

			select {
			case lineCh <- line:
			case <-done:
				return
			}
		}
	}()

	deadline := time.NewTimer(2 * time.Second)
	defer deadline.Stop()

	for {
		select {
		case <-deadline.C:
			t.Fatalf("timed out waiting for SSE markers %v in stream %q", markers, stream.String())
		case err := <-errCh:
			t.Fatalf("ReadString returned error before all markers arrived: %v (stream=%q)", err, stream.String())
		case line := <-lineCh:
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
}

type connectImportWorkbenchScenario struct {
	Server          *httptest.Server
	ProjectID       string
	OrganizationID  string
	ShotExecutionID string
	RunID           string
	ImportBatchID   string
	AssetClient     assetv1connect.AssetServiceClient
}

func seedConnectImportWorkbenchScenario(t *testing.T, title string) connectImportWorkbenchScenario {
	t.Helper()

	ctx := context.Background()
	store := db.NewMemoryStore()
	seedConnectAuthStore(store)
	services := runtime.NewFactory(store).Services()

	project, err := services.ProjectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          connectTestOrgID,
		OwnerUserID:             connectTestUserID,
		Title:                   title,
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	episode, err := services.ProjectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}
	scene, err := services.ContentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "导入场景",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}
	shot, err := services.ContentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "导入镜头",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(services))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	executionClient := executionv1connect.NewExecutionServiceClient(server.Client(), server.URL)
	assetClient := assetv1connect.NewAssetServiceClient(server.Client(), server.URL)

	run, err := executionClient.StartShotExecutionRun(ctx, connectrpc.NewRequest(&executionv1.StartShotExecutionRunRequest{
		ShotId:      shot.ID,
		OperatorId:  connectTestUserID,
		ProjectId:   project.ID,
		OrgId:       project.OrganizationID,
		TriggerType: "manual",
	}))
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}

	importBatch, err := assetClient.CreateImportBatch(ctx, connectrpc.NewRequest(&assetv1.CreateImportBatchRequest{
		ProjectId:  project.ID,
		OrgId:      project.OrganizationID,
		OperatorId: connectTestUserID,
		SourceType: "manual_upload",
	}))
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}

	return connectImportWorkbenchScenario{
		Server:          server,
		ProjectID:       project.ID,
		OrganizationID:  project.OrganizationID,
		ShotExecutionID: run.Msg.GetRun().GetShotExecutionId(),
		RunID:           run.Msg.GetRun().GetId(),
		ImportBatchID:   importBatch.Msg.GetImportBatch().GetId(),
		AssetClient:     assetClient,
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
	req.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))

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

func newRouteDependenciesFromStore(store *db.MemoryStore) RouteDependencies {
	seedConnectAuthStore(store)
	return NewRouteDependencies(runtime.NewFactory(store).Services())
}

func seedConnectAuthStore(store *db.MemoryStore) {
	if store == nil {
		return
	}
	store.Organizations[connectTestOrgID] = orgdomain.Organization{
		ID:                   connectTestOrgID,
		Slug:                 "connect-test-org",
		DisplayName:          "Connect Test Organization",
		DefaultUILocale:      "zh-CN",
		DefaultContentLocale: "zh-CN",
	}
	store.Users[connectTestUserID] = authdomain.User{
		ID:                connectTestUserID,
		Email:             "connect-test@hualala.local",
		DisplayName:       "Connect Test User",
		PreferredUILocale: "zh-CN",
	}
	store.Roles["connect-test-role"] = orgdomain.Role{
		ID:          "connect-test-role",
		OrgID:       connectTestOrgID,
		Code:        "admin",
		DisplayName: "Administrator",
	}
	store.Memberships["connect-test-membership"] = orgdomain.Member{
		ID:     "connect-test-membership",
		OrgID:  connectTestOrgID,
		UserID: connectTestUserID,
		RoleID: "connect-test-role",
		Status: "active",
	}
}
