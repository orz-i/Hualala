package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	connectrpc "connectrpc.com/connect"
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	assetv1connect "github.com/hualala/apps/backend/gen/hualala/asset/v1/assetv1connect"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestAssetMonitorRoutesExposeImportBatchSummariesAndStructuredProvenance(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	projectService := projectapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          "org-1",
		OwnerUserID:             "user-1",
		Title:                   "Asset Monitor",
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
		"file_name":          "candidate.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         2048,
		"expires_in_seconds": 60,
	})
	sessionID := createResp["session_id"].(string)

	completeResp := performConnectUploadJSONRequest(t, server, http.MethodPost, "/upload/sessions/"+sessionID+"/complete", map[string]any{
		"variant_type":  "original",
		"mime_type":     "image/png",
		"locale":        "zh-CN",
		"rights_status": "clear",
		"ai_annotated":  true,
		"width":         1280,
		"height":        720,
	})
	assetID := completeResp["asset_id"].(string)

	batches, err := assetClient.ListImportBatches(ctx, connectrpc.NewRequest(&assetv1.ListImportBatchesRequest{
		ProjectId:  project.ID,
		Status:     "uploaded_pending_match",
		SourceType: "upload_session",
	}))
	if err != nil {
		t.Fatalf("ListImportBatches returned error: %v", err)
	}
	if len(batches.Msg.GetImportBatches()) != 1 {
		t.Fatalf("expected 1 import batch summary, got %d", len(batches.Msg.GetImportBatches()))
	}
	summary := batches.Msg.GetImportBatches()[0]
	if got := summary.GetId(); got != importBatchID {
		t.Fatalf("expected import batch %q, got %q", importBatchID, got)
	}
	if got := summary.GetUploadSessionCount(); got != 1 {
		t.Fatalf("expected upload_session_count 1, got %d", got)
	}
	if got := summary.GetItemCount(); got != 1 {
		t.Fatalf("expected item_count 1, got %d", got)
	}
	if got := summary.GetMediaAssetCount(); got != 1 {
		t.Fatalf("expected media_asset_count 1, got %d", got)
	}

	provenance, err := assetClient.GetAssetProvenanceSummary(ctx, connectrpc.NewRequest(&assetv1.GetAssetProvenanceSummaryRequest{
		AssetId: assetID,
	}))
	if err != nil {
		t.Fatalf("GetAssetProvenanceSummary returned error: %v", err)
	}
	if got := provenance.Msg.GetAsset().GetId(); got != assetID {
		t.Fatalf("expected asset %q, got %q", assetID, got)
	}
	if got := provenance.Msg.GetImportBatchId(); got != importBatchID {
		t.Fatalf("expected import_batch_id %q, got %q", importBatchID, got)
	}
	if got := provenance.Msg.GetVariantCount(); got != 1 {
		t.Fatalf("expected variant_count 1, got %d", got)
	}
	if got := provenance.Msg.GetProvenanceSummary(); !strings.Contains(got, "source_type=upload_session") {
		t.Fatalf("expected provenance_summary to describe source_type, got %q", got)
	}
}
