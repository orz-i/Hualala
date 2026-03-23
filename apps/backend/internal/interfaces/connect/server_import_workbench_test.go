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
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

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
	contentService := contentapp.NewService(store, store.Publisher())

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
