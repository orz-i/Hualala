package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/projectapp"
	assetdomain "github.com/hualala/apps/backend/internal/domain/asset"
	contentdomain "github.com/hualala/apps/backend/internal/domain/content"
	executiondomain "github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/project"
	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
	"github.com/hualala/apps/backend/internal/platform/runtime"
	_ "github.com/lib/pq"
)

const integrationSSEReplayTimeout = 5 * time.Second

func TestOpenStoreReturnsNativePostgresRuntime(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, "native-runtime")
	defer closeFn()

	if _, ok := runtimeStore.(*db.MemoryStore); ok {
		t.Fatalf("expected postgres runtime store not to expose *db.MemoryStore")
	}
}

func TestPostgresPublisherReplaysDurableEventsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "durable-events"
	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
	publisher := runtimeStore.Publisher()
	projectID := runtimeStore.GenerateProjectID()
	if err := runtimeStore.SaveProject(context.Background(), project.Project{
		ID:                   projectID,
		OrganizationID:       db.DefaultDevOrganizationID,
		OwnerUserID:          db.DefaultDevUserID,
		Title:                "Durable Event Project",
		Status:               "draft",
		CurrentStage:         "planning",
		PrimaryContentLocale: "zh-CN",
		CreatedAt:            publishedAt(),
		UpdatedAt:            publishedAt(),
	}); err != nil {
		t.Fatalf("SaveProject returned error: %v", err)
	}
	published := publisher.Publish(events.Event{
		EventType:      "workflow.updated",
		OrganizationID: db.DefaultDevOrganizationID,
		ProjectID:      projectID,
		ResourceType:   "workflow_run",
		ResourceID:     "workflow-run-durable-1",
		Payload:        `{"status":"running"}`,
	})
	closeFn()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	defer reloadCloseFn()

	reloadedPublisher := reloadedStore.Publisher()
	reloadedPublisher.Publish(events.Event{
		EventType:      "asset.import_batch.updated",
		OrganizationID: db.DefaultDevOrganizationID,
		ProjectID:      projectID,
		ResourceType:   "import_batch",
		ResourceID:     "import-batch-durable-2",
		Payload:        `{"status":"confirmed"}`,
	})

	replayed := reloadedPublisher.List(db.DefaultDevOrganizationID, projectID, "")
	if len(replayed) != 2 {
		t.Fatalf("expected 2 durable events after reopen and republish, got %d", len(replayed))
	}
	if got := replayed[0].ID; got != published.ID {
		t.Fatalf("expected replayed event id %q, got %q", published.ID, got)
	}
	if got := replayed[0].EventType; got != "workflow.updated" {
		t.Fatalf("expected workflow.updated replay, got %q", got)
	}

	tail := reloadedPublisher.List(db.DefaultDevOrganizationID, projectID, published.ID)
	if len(tail) != 1 {
		t.Fatalf("expected 1 replayed event after cursor, got %d", len(tail))
	}
	if got := tail[0].EventType; got != "asset.import_batch.updated" {
		t.Fatalf("expected asset.import_batch.updated after cursor, got %q", got)
	}
}

func TestPostgresGatewayResultsPersistConcurrentKeys(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	resetNativeIntegrationRuntimeStore(t)
	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, "gateway-results")
	defer closeFn()

	const workerCount = 12
	start := make(chan struct{})
	var wg sync.WaitGroup
	errCh := make(chan error, workerCount)

	for i := range workerCount {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			<-start
			key := fmt.Sprintf("idem-%02d", index)
			errCh <- runtimeStore.SaveGatewayResult(context.Background(), key, gateway.GatewayResult{
				Provider:          "seedance",
				ExternalRequestID: fmt.Sprintf("external-%02d", index),
			})
		}(i)
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("SaveGatewayResult returned error: %v", err)
		}
	}
	for i := range workerCount {
		key := fmt.Sprintf("idem-%02d", i)
		record, ok := runtimeStore.GetGatewayResult(key)
		if !ok {
			t.Fatalf("expected gateway result for %s", key)
		}
		if record.ExternalRequestID != fmt.Sprintf("external-%02d", i) {
			t.Fatalf("expected external id for %s to persist, got %q", key, record.ExternalRequestID)
		}
	}
}

func TestExpiredUploadSessionRetryPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-retry"
	resetNativeIntegrationRuntimeStore(t)
	doUploadRequest := func(t *testing.T, client *http.Client, method string, url string, body string) map[string]any {
		t.Helper()

		var requestBody io.Reader
		if body != "" {
			requestBody = strings.NewReader(body)
		}
		request, err := http.NewRequest(method, url, requestBody)
		if err != nil {
			t.Fatalf("http.NewRequest %s %s returned error: %v", method, url, err)
		}
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		request.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

		response, err := client.Do(request)
		if err != nil {
			t.Fatalf("%s %s returned error: %v", method, url, err)
		}
		defer response.Body.Close()

		responseBody, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatalf("io.ReadAll %s %s returned error: %v", method, url, err)
		}
		if response.StatusCode != http.StatusOK {
			t.Fatalf("%s %s returned status %d with body %s", method, url, response.StatusCode, string(responseBody))
		}

		var payload map[string]any
		if err := json.Unmarshal(responseBody, &payload); err != nil {
			t.Fatalf("json.Unmarshal %s %s returned error: %v", method, url, err)
		}
		return payload
	}

	var sessionID string

	t.Run("create and retry expired session", func(t *testing.T) {
		runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
		defer closeFn()

		services := runtime.NewFactory(runtimeStore).Services()
		projectRecord, err := services.ProjectService.CreateProject(context.Background(), projectapp.CreateProjectInput{
			OrganizationID:          db.DefaultDevOrganizationID,
			OwnerUserID:             db.DefaultDevUserID,
			Title:                   "Retry Upload Project",
			PrimaryContentLocale:    "zh-CN",
			SupportedContentLocales: []string{"zh-CN"},
		})
		if err != nil {
			t.Fatalf("CreateProject returned error: %v", err)
		}

		mux := http.NewServeMux()
		connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(services))
		server := httptest.NewServer(mux)
		defer server.Close()

		createPayload := `{"organization_id":"` + projectRecord.OrganizationID + `","project_id":"` + projectRecord.ID + `","file_name":"shot.png","checksum":"sha256:abc123","size_bytes":1024,"expires_in_seconds":0}`
		created := doUploadRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", createPayload)
		sessionID = created["session_id"].(string)

		retried := doUploadRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/retry", "")
		if got := retried["status"].(string); got != "pending" {
			t.Fatalf("expected retry response status pending, got %q", got)
		}
	})

	t.Run("verify session persists after reopen", func(t *testing.T) {
		if sessionID == "" {
			t.Fatal("expected sessionID from create-and-retry stage")
		}

		reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
		defer reloadCloseFn()

		record, ok := reloadedStore.GetUploadSession(sessionID)
		if !ok {
			t.Fatalf("expected upload session %q after reopen", sessionID)
		}
		if got := record.Status; got != "pending" {
			t.Fatalf("expected reopened upload session status pending, got %q", got)
		}
		if got := record.RetryCount; got != 1 {
			t.Fatalf("expected reopened upload session retry_count 1, got %d", got)
		}
		if !record.ExpiresAt.After(time.Now().UTC()) {
			t.Fatalf("expected reopened upload session to keep future expiry, got %s", record.ExpiresAt.Format(time.RFC3339))
		}
	})
}

func TestExpiredUploadSessionRetryCompletePersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-retry-complete"
	resetNativeIntegrationRuntimeStore(t)

	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
	server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
	initialCleanup := closeUploadIntegrationResources(server, closeFn)
	defer initialCleanup()

	projectRecord := createUploadIntegrationProject(t, services, "Retry Complete Upload Project")
	importBatch := seedUploadIntegrationImportBatch(t, runtimeStore, projectRecord)

	created := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", map[string]any{
		"organization_id":    projectRecord.OrganizationID,
		"project_id":         projectRecord.ID,
		"import_batch_id":    importBatch.ID,
		"file_name":          "shot.png",
		"checksum":           "sha256:complete123",
		"size_bytes":         2048,
		"expires_in_seconds": 0,
	})
	sessionID := created["session_id"].(string)

	createEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	if len(createEvents) != 2 {
		t.Fatalf("expected 2 create events after upload session creation, got %d", len(createEvents))
	}
	lastEventID := createEvents[len(createEvents)-1].ID

	retried := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/retry", nil)
	if got := retried["status"].(string); got != "pending" {
		t.Fatalf("expected retried upload session status pending, got %q", got)
	}
	if got := retried["retry_count"].(float64); got != 1 {
		t.Fatalf("expected retried upload session retry_count 1, got %.0f", got)
	}

	completed := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/complete", map[string]any{
		"variant_type":  "original",
		"mime_type":     "image/png",
		"locale":        "zh-CN",
		"rights_status": "clear",
		"ai_annotated":  true,
		"width":         1920,
		"height":        1080,
	})
	if got := completed["status"].(string); got != "uploaded" {
		t.Fatalf("expected completed upload session status uploaded, got %q", got)
	}
	if got := completed["retry_count"].(float64); got != 1 {
		t.Fatalf("expected completed upload session retry_count 1, got %.0f", got)
	}
	if got := completed["asset_id"].(string); got == "" {
		t.Fatal("expected asset_id in upload complete response, got empty")
	}
	if got := completed["upload_file_id"].(string); got == "" {
		t.Fatal("expected upload_file_id in upload complete response, got empty")
	}
	if got := completed["variant_id"].(string); got == "" {
		t.Fatal("expected variant_id in upload complete response, got empty")
	}

	initialCleanup()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
	defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

	reopened := performUploadSessionRequest(t, reloadedServer.Client(), http.MethodGet, reloadedServer.URL+"/upload/sessions/"+sessionID, nil)
	if got := reopened["session_id"].(string); got != sessionID {
		t.Fatalf("expected reopened upload session_id %q, got %q", sessionID, got)
	}
	if got := reopened["status"].(string); got != "uploaded" {
		t.Fatalf("expected reopened upload session status uploaded, got %q", got)
	}
	if got := reopened["retry_count"].(float64); got != 1 {
		t.Fatalf("expected reopened upload session retry_count 1, got %.0f", got)
	}
	reopenedAssetID := reopened["asset_id"].(string)
	if reopenedAssetID == "" {
		t.Fatal("expected reopened upload session asset_id, got empty")
	}
	reopenedUploadFileID := reopened["upload_file_id"].(string)
	if reopenedUploadFileID == "" {
		t.Fatal("expected reopened upload session upload_file_id, got empty")
	}
	reopenedVariantID := reopened["variant_id"].(string)
	if reopenedVariantID == "" {
		t.Fatal("expected reopened upload session variant_id, got empty")
	}

	record, ok := reloadedStore.GetUploadSession(sessionID)
	if !ok {
		t.Fatalf("expected upload session %q after reopen", sessionID)
	}
	if got := record.Status; got != "uploaded" {
		t.Fatalf("expected stored upload session status uploaded after reopen, got %q", got)
	}
	if got := record.RetryCount; got != 1 {
		t.Fatalf("expected stored upload session retry_count 1 after reopen, got %d", got)
	}

	uploadFiles := reloadedStore.ListUploadFilesBySessionIDs([]string{sessionID})
	if len(uploadFiles) != 1 {
		t.Fatalf("expected 1 upload file after reopen, got %d", len(uploadFiles))
	}
	if got := uploadFiles[0].ID; got != reopenedUploadFileID {
		t.Fatalf("expected upload file id %q after reopen, got %q", reopenedUploadFileID, got)
	}

	mediaAssets := reloadedStore.ListMediaAssetsByImportBatch(importBatch.ID)
	if len(mediaAssets) != 1 {
		t.Fatalf("expected 1 media asset after reopen, got %d", len(mediaAssets))
	}
	if got := mediaAssets[0].ID; got != reopenedAssetID {
		t.Fatalf("expected media asset id %q after reopen, got %q", reopenedAssetID, got)
	}

	variants := reloadedStore.ListMediaAssetVariantsByUploadFileIDs([]string{uploadFiles[0].ID})
	if len(variants) != 1 {
		t.Fatalf("expected 1 media asset variant after reopen, got %d", len(variants))
	}
	if got := variants[0].ID; got != reopenedVariantID {
		t.Fatalf("expected media asset variant id %q after reopen, got %q", reopenedVariantID, got)
	}

	items := reloadedStore.ListImportBatchItems(importBatch.ID)
	if len(items) != 1 {
		t.Fatalf("expected 1 import batch item after reopen, got %d", len(items))
	}
	if got := items[0].Status; got != "uploaded_pending_match" {
		t.Fatalf("expected import batch item status uploaded_pending_match after reopen, got %q", got)
	}
	if got := items[0].AssetID; got != reopenedAssetID {
		t.Fatalf("expected import batch item asset_id %q after reopen, got %q", reopenedAssetID, got)
	}

	batch, ok := reloadedStore.GetImportBatch(importBatch.ID)
	if !ok {
		t.Fatalf("expected import batch %q after reopen", importBatch.ID)
	}
	if got := batch.Status; got != "uploaded_pending_match" {
		t.Fatalf("expected import batch status uploaded_pending_match after reopen, got %q", got)
	}

	replayedStream := readUploadReplayStream(t, reloadedServer, projectRecord.OrganizationID, projectRecord.ID, lastEventID, integrationSSEReplayTimeout,
		"event: asset.upload_session.updated",
		`"session_id":"`+sessionID+`"`,
		`"status":"uploaded"`,
		`"retry_count":1`,
		"event: asset.import_batch.updated",
		`"reason":"upload_session.completed"`,
		`"upload_session_id":"`+sessionID+`"`,
	)
	if !strings.Contains(replayedStream, "event: asset.upload_session.updated") {
		t.Fatalf("expected asset.upload_session.updated in replay stream, got %q", replayedStream)
	}
	if !strings.Contains(replayedStream, `"reason":"upload_session.completed"`) {
		t.Fatalf("expected upload_session.completed replay payload, got %q", replayedStream)
	}
}

func TestUploadSessionCompleteWithShotExecutionPersistsAcrossReopen(t *testing.T) {
	cfg := config.Load()
	if cfg.DBDriver != "postgres" {
		t.Skipf("requires postgres driver, got %q", cfg.DBDriver)
	}

	storeKey := "upload-complete-shot-execution"
	resetNativeIntegrationRuntimeStore(t)

	runtimeStore, closeFn := openNativeIntegrationRuntimeStore(t, storeKey)
	server, services := newUploadIntegrationHTTPServer(t, runtimeStore)
	initialCleanup := closeUploadIntegrationResources(server, closeFn)
	defer initialCleanup()

	projectRecord := createUploadIntegrationProject(t, services, "Shot Execution Upload Project")
	importBatch := seedUploadIntegrationImportBatch(t, runtimeStore, projectRecord)
	shotExecution := seedUploadIntegrationShotExecution(t, runtimeStore, projectRecord)

	created := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions", map[string]any{
		"organization_id":    projectRecord.OrganizationID,
		"project_id":         projectRecord.ID,
		"import_batch_id":    importBatch.ID,
		"file_name":          "candidate-shot.png",
		"checksum":           "sha256:candidate123",
		"size_bytes":         4096,
		"expires_in_seconds": 60,
	})
	sessionID := created["session_id"].(string)

	createEvents := runtimeStore.Publisher().List(projectRecord.OrganizationID, projectRecord.ID, "")
	if len(createEvents) != 2 {
		t.Fatalf("expected 2 create events after upload session creation, got %d", len(createEvents))
	}
	lastEventID := createEvents[len(createEvents)-1].ID

	completed := performUploadSessionRequest(t, server.Client(), http.MethodPost, server.URL+"/upload/sessions/"+sessionID+"/complete", map[string]any{
		"shot_execution_id": shotExecution.ID,
		"variant_type":      "original",
		"mime_type":         "image/png",
		"locale":            "zh-CN",
		"rights_status":     "clear",
		"ai_annotated":      true,
		"width":             1920,
		"height":            1080,
	})
	if got := completed["status"].(string); got != "uploaded" {
		t.Fatalf("expected completed upload session status uploaded, got %q", got)
	}
	if got := completed["retry_count"].(float64); got != 0 {
		t.Fatalf("expected completed upload session retry_count 0, got %.0f", got)
	}
	if got := completed["asset_id"].(string); got == "" {
		t.Fatal("expected asset_id in candidate attach response, got empty")
	}
	if got := completed["upload_file_id"].(string); got == "" {
		t.Fatal("expected upload_file_id in candidate attach response, got empty")
	}
	if got := completed["variant_id"].(string); got == "" {
		t.Fatal("expected variant_id in candidate attach response, got empty")
	}
	if got := completed["candidate_asset_id"].(string); got == "" {
		t.Fatal("expected candidate_asset_id in candidate attach response, got empty")
	}
	if got := completed["shot_execution_id"].(string); got != shotExecution.ID {
		t.Fatalf("expected shot_execution_id %q, got %q", shotExecution.ID, got)
	}

	initialCleanup()

	reloadedStore, reloadCloseFn := openNativeIntegrationRuntimeStore(t, storeKey)
	reloadedServer, _ := newUploadIntegrationHTTPServer(t, reloadedStore)
	defer closeUploadIntegrationResources(reloadedServer, reloadCloseFn)()

	reopened := performUploadSessionRequest(t, reloadedServer.Client(), http.MethodGet, reloadedServer.URL+"/upload/sessions/"+sessionID, nil)
	if got := reopened["session_id"].(string); got != sessionID {
		t.Fatalf("expected reopened upload session_id %q, got %q", sessionID, got)
	}
	if got := reopened["status"].(string); got != "uploaded" {
		t.Fatalf("expected reopened upload session status uploaded, got %q", got)
	}
	if got := reopened["retry_count"].(float64); got != 0 {
		t.Fatalf("expected reopened upload session retry_count 0, got %.0f", got)
	}
	reopenedAssetID := reopened["asset_id"].(string)
	if reopenedAssetID == "" {
		t.Fatal("expected reopened asset_id, got empty")
	}
	reopenedUploadFileID := reopened["upload_file_id"].(string)
	if reopenedUploadFileID == "" {
		t.Fatal("expected reopened upload_file_id, got empty")
	}
	reopenedVariantID := reopened["variant_id"].(string)
	if reopenedVariantID == "" {
		t.Fatal("expected reopened variant_id, got empty")
	}
	reopenedCandidateAssetID := reopened["candidate_asset_id"].(string)
	if reopenedCandidateAssetID == "" {
		t.Fatal("expected reopened candidate_asset_id, got empty")
	}
	if got := reopened["shot_execution_id"].(string); got != shotExecution.ID {
		t.Fatalf("expected reopened shot_execution_id %q, got %q", shotExecution.ID, got)
	}

	uploadFiles := reloadedStore.ListUploadFilesBySessionIDs([]string{sessionID})
	if len(uploadFiles) != 1 {
		t.Fatalf("expected 1 upload file after reopen, got %d", len(uploadFiles))
	}
	if got := uploadFiles[0].ID; got != reopenedUploadFileID {
		t.Fatalf("expected reopened upload_file_id %q, got %q", reopenedUploadFileID, got)
	}

	mediaAssets := reloadedStore.ListMediaAssetsByImportBatch(importBatch.ID)
	if len(mediaAssets) != 1 {
		t.Fatalf("expected 1 media asset after reopen, got %d", len(mediaAssets))
	}
	if got := mediaAssets[0].ID; got != reopenedAssetID {
		t.Fatalf("expected reopened asset_id %q, got %q", reopenedAssetID, got)
	}

	variants := reloadedStore.ListMediaAssetVariantsByUploadFileIDs([]string{uploadFiles[0].ID})
	if len(variants) != 1 {
		t.Fatalf("expected 1 media asset variant after reopen, got %d", len(variants))
	}
	if got := variants[0].ID; got != reopenedVariantID {
		t.Fatalf("expected reopened variant_id %q, got %q", reopenedVariantID, got)
	}

	candidates := reloadedStore.ListCandidateAssetsByExecution(shotExecution.ID)
	if len(candidates) != 1 {
		t.Fatalf("expected 1 candidate asset after reopen, got %d", len(candidates))
	}
	if got := candidates[0].ID; got != reopenedCandidateAssetID {
		t.Fatalf("expected reopened candidate_asset_id %q, got %q", reopenedCandidateAssetID, got)
	}
	if got := candidates[0].AssetID; got != reopenedAssetID {
		t.Fatalf("expected candidate asset to reference asset_id %q, got %q", reopenedAssetID, got)
	}

	reloadedShotExecution, ok := reloadedStore.GetShotExecution(shotExecution.ID)
	if !ok {
		t.Fatalf("expected shot execution %q after reopen", shotExecution.ID)
	}
	if got := reloadedShotExecution.Status; got != "candidate_ready" {
		t.Fatalf("expected shot execution status candidate_ready after reopen, got %q", got)
	}

	items := reloadedStore.ListImportBatchItems(importBatch.ID)
	if len(items) != 1 {
		t.Fatalf("expected 1 import batch item after reopen, got %d", len(items))
	}
	if got := items[0].Status; got != "matched_pending_confirm" {
		t.Fatalf("expected import batch item status matched_pending_confirm after reopen, got %q", got)
	}
	if got := items[0].MatchedShotID; got != shotExecution.ShotID {
		t.Fatalf("expected matched_shot_id %q after reopen, got %q", shotExecution.ShotID, got)
	}
	if got := items[0].AssetID; got != reopenedAssetID {
		t.Fatalf("expected import batch item asset_id %q after reopen, got %q", reopenedAssetID, got)
	}

	batch, ok := reloadedStore.GetImportBatch(importBatch.ID)
	if !ok {
		t.Fatalf("expected import batch %q after reopen", importBatch.ID)
	}
	if got := batch.Status; got != "matched_pending_confirm" {
		t.Fatalf("expected import batch status matched_pending_confirm after reopen, got %q", got)
	}

	replayedStream := readUploadReplayStream(t, reloadedServer, projectRecord.OrganizationID, projectRecord.ID, lastEventID, integrationSSEReplayTimeout,
		"event: asset.upload_session.updated",
		`"session_id":"`+sessionID+`"`,
		`"status":"uploaded"`,
		"event: asset.import_batch.updated",
		`"status":"matched_pending_confirm"`,
		`"reason":"upload_session.completed"`,
		`"upload_session_id":"`+sessionID+`"`,
	)
	if !strings.Contains(replayedStream, "event: asset.import_batch.updated") {
		t.Fatalf("expected asset.import_batch.updated in replay stream, got %q", replayedStream)
	}
}

func publishedAt() time.Time {
	return time.Now().UTC()
}

func resetNativeIntegrationRuntimeStore(t *testing.T) {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	resetIntegrationRuntimeState(t, migrationsDir)
}

func openNativeIntegrationRuntimeStore(t *testing.T, suffix string) (db.RuntimeStore, func()) {
	t.Helper()

	cfg := config.Load()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	runtimeStore, closeFn, err := db.OpenStore(context.Background(), db.OpenStoreOptions{
		Driver:        cfg.DBDriver,
		DatabaseURL:   cfg.DatabaseURL,
		AutoMigrate:   cfg.AutoMigrate,
		MigrationsDir: migrationsDir,
		StoreKey:      fmt.Sprintf("integration-%s-%s", t.Name(), suffix),
	})
	if err != nil {
		t.Fatalf("OpenStore returned error: %v", err)
	}

	return runtimeStore, func() {
		if closeFn != nil {
			if err := closeFn(); err != nil {
				t.Fatalf("closeFn returned error: %v", err)
			}
		}
	}
}

func newUploadIntegrationHTTPServer(t *testing.T, runtimeStore db.RuntimeStore) (*httptest.Server, runtime.ServiceSet) {
	t.Helper()

	services := runtime.NewFactory(runtimeStore).Services()
	mux := http.NewServeMux()
	connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(services))
	return httptest.NewServer(mux), services
}

func createUploadIntegrationProject(t *testing.T, services runtime.ServiceSet, title string) project.Project {
	t.Helper()

	projectRecord, err := services.ProjectService.CreateProject(context.Background(), projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   title,
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	return projectRecord
}

func seedUploadIntegrationImportBatch(t *testing.T, runtimeStore db.RuntimeStore, projectRecord project.Project) assetdomain.ImportBatch {
	t.Helper()

	now := publishedAt()
	record := assetdomain.ImportBatch{
		ID:         runtimeStore.GenerateImportBatchID(),
		OrgID:      projectRecord.OrganizationID,
		ProjectID:  projectRecord.ID,
		OperatorID: db.DefaultDevUserID,
		SourceType: "upload_session",
		Status:     "pending_review",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := runtimeStore.SaveImportBatch(context.Background(), record); err != nil {
		t.Fatalf("SaveImportBatch returned error: %v", err)
	}
	return record
}

func seedUploadIntegrationShotExecution(t *testing.T, runtimeStore db.RuntimeStore, projectRecord project.Project) executiondomain.ShotExecution {
	t.Helper()

	now := publishedAt()
	episodeRecord := project.Episode{
		ID:        runtimeStore.GenerateEpisodeID(),
		ProjectID: projectRecord.ID,
		EpisodeNo: 1,
		Title:     "Episode 1",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := runtimeStore.SaveEpisode(context.Background(), episodeRecord); err != nil {
		t.Fatalf("SaveEpisode returned error: %v", err)
	}

	sceneRecord := contentdomain.Scene{
		ID:           runtimeStore.GenerateSceneID(),
		ProjectID:    projectRecord.ID,
		EpisodeID:    episodeRecord.ID,
		SceneNo:      1,
		Title:        "Scene 1",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := runtimeStore.SaveScene(context.Background(), sceneRecord); err != nil {
		t.Fatalf("SaveScene returned error: %v", err)
	}

	shotRecord := contentdomain.Shot{
		ID:           runtimeStore.GenerateShotID(),
		SceneID:      sceneRecord.ID,
		ShotNo:       1,
		Code:         "SHOT-001",
		Title:        "Shot 1",
		SourceLocale: "zh-CN",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := runtimeStore.SaveShot(context.Background(), shotRecord); err != nil {
		t.Fatalf("SaveShot returned error: %v", err)
	}

	record := executiondomain.ShotExecution{
		ID:        runtimeStore.GenerateShotExecutionID(),
		OrgID:     projectRecord.OrganizationID,
		ProjectID: projectRecord.ID,
		ShotID:    shotRecord.ID,
		Status:    "in_progress",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := runtimeStore.SaveShotExecution(context.Background(), record); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}
	return record
}

func performUploadSessionRequest(t *testing.T, client *http.Client, method string, url string, body any) map[string]any {
	t.Helper()

	var requestBody io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("json.Marshal %s %s returned error: %v", method, url, err)
		}
		requestBody = bytes.NewReader(payload)
	}

	request, err := http.NewRequest(method, url, requestBody)
	if err != nil {
		t.Fatalf("http.NewRequest %s %s returned error: %v", method, url, err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("%s %s returned error: %v", method, url, err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("io.ReadAll %s %s returned error: %v", method, url, err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("%s %s returned status %d with body %s", method, url, response.StatusCode, string(responseBody))
	}

	var payload map[string]any
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		t.Fatalf("json.Unmarshal %s %s returned error: %v", method, url, err)
	}
	return payload
}

func readUploadReplayStream(t *testing.T, server *httptest.Server, organizationID string, projectID string, lastEventID string, timeout time.Duration, markers ...string) string {
	t.Helper()

	if timeout <= 0 {
		timeout = integrationSSEReplayTimeout
	}
	sseCtx, cancelSSE := context.WithTimeout(context.Background(), timeout)
	defer cancelSSE()

	request, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+organizationID+"&project_id="+projectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	request.Header.Set("Last-Event-ID", lastEventID)
	request.Header.Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))

	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected SSE status 200, got %d with body %s", response.StatusCode, string(body))
	}

	return readReliabilityEventStreamUntil(t, response.Body, cancelSSE, timeout, markers...)
}

func closeUploadIntegrationResources(server *httptest.Server, closeFn func()) func() {
	var once sync.Once
	return func() {
		once.Do(func() {
			if server != nil {
				server.Close()
			}
			if closeFn != nil {
				closeFn()
			}
		})
	}
}
