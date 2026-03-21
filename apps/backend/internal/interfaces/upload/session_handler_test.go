package upload

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

	"github.com/hualala/apps/backend/internal/application/policyapp"
	assetdomain "github.com/hualala/apps/backend/internal/domain/asset"
	executiondomain "github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestCreateAndRetryUploadSession(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))

	createPayload := map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 1,
	}
	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", createPayload)
	createResponse := decodeUploadJSONResponse(t, createRec)
	if got := createResponse["status"].(string); got != "pending" {
		t.Fatalf("expected pending upload session, got %q", got)
	}
	if got := createResponse["retry_count"].(float64); got != 0 {
		t.Fatalf("expected retry_count 0, got %.0f", got)
	}

	sessionID := createResponse["session_id"].(string)
	retryRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions/"+sessionID+"/retry", nil)
	retryResponse := decodeUploadJSONResponse(t, retryRec)
	if got := retryResponse["retry_count"].(float64); got != 1 {
		t.Fatalf("expected retry_count 1 after retry, got %.0f", got)
	}
	if hint := retryResponse["resume_hint"].(string); !strings.Contains(hint, "retry from byte 0") {
		t.Fatalf("expected retry resume hint, got %q", hint)
	}
}

func TestExpiredUploadSessionStatus(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))

	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 0,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	statusReq := httptest.NewRequest(http.MethodGet, "/upload/sessions/"+sessionID, nil)
	statusRec := httptest.NewRecorder()
	mux.ServeHTTP(statusRec, statusReq)

	if statusRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", statusRec.Code)
	}
	statusResponse := decodeUploadJSONResponse(t, statusRec)
	if got := statusResponse["status"].(string); got != "expired" {
		t.Fatalf("expected expired upload session, got %q", got)
	}
	if hint := statusResponse["resume_hint"].(string); !strings.Contains(hint, "create a retry session") {
		t.Fatalf("expected expired resume hint, got %q", hint)
	}
}

func TestUploadSessionsAreScopedToStore(t *testing.T) {
	storeA := db.NewMemoryStore()
	storeB := db.NewMemoryStore()
	resetSessionStore(storeA)
	resetSessionStore(storeB)

	muxA := http.NewServeMux()
	RegisterRoutes(muxA, newUploadServiceFromStore(storeA))
	muxB := http.NewServeMux()
	RegisterRoutes(muxB, newUploadServiceFromStore(storeB))

	createRec := performUploadJSONRequest(t, muxA, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	statusReq := httptest.NewRequest(http.MethodGet, "/upload/sessions/"+sessionID, nil)
	statusRec := httptest.NewRecorder()
	muxB.ServeHTTP(statusRec, statusReq)

	if statusRec.Code != http.StatusNotFound {
		t.Fatalf("expected store-scoped session to be missing from another store, got %d with body %s", statusRec.Code, statusRec.Body.String())
	}
}

func TestUploadSessionPublishesSSEEvents(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)
	store.EventPublisher.Reset()

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))
	sse.RegisterRoutes(mux, store.EventPublisher)

	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	retryRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions/"+sessionID+"/retry", nil)
	retryResponse := decodeUploadJSONResponse(t, retryRec)
	if got := retryResponse["retry_count"].(float64); got != 1 {
		t.Fatalf("expected retry_count 1 after retry, got %.0f", got)
	}

	server := httptest.NewServer(mux)
	defer server.Close()

	sseCtx, cancelSSE := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id=org-1&project_id=project-1", nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("server.Client().Do returned error: %v", err)
	}
	defer sseResp.Body.Close()

	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseResp.StatusCode)
	}

	stream := readUploadEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: asset.upload_session.updated",
		`"session_id":"`+sessionID+`"`,
		`"retry_count":1`,
	)
	if !strings.Contains(stream, "event: asset.upload_session.updated") {
		t.Fatalf("expected upload session SSE event, got body %q", stream)
	}
	if !strings.Contains(stream, `"session_id":"`+sessionID+`"`) {
		t.Fatalf("expected upload session id in SSE payload, got body %q", stream)
	}
	if !strings.Contains(stream, `"retry_count":1`) {
		t.Fatalf("expected retry_count 1 in SSE payload, got body %q", stream)
	}
}

func TestUploadSessionPublishesImportBatchProjectEvent(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)
	store.EventPublisher.Reset()
	store.ImportBatches["import-batch-1"] = assetdomain.ImportBatch{
		ID:         "import-batch-1",
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "upload_session",
		Status:     "pending_review",
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))
	sse.RegisterRoutes(mux, store.EventPublisher)

	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"import_batch_id":    "import-batch-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions/"+sessionID+"/retry", nil)

	server := httptest.NewServer(mux)
	defer server.Close()

	sseCtx, cancelSSE := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id=org-1&project_id=project-1", nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("server.Client().Do returned error: %v", err)
	}
	defer sseResp.Body.Close()

	stream := readUploadEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: asset.import_batch.updated",
		`"import_batch_id":"import-batch-1"`,
		`"status":"pending_review"`,
		`"upload_session_id":"`+sessionID+`"`,
	)
	if !strings.Contains(stream, "event: asset.import_batch.updated") {
		t.Fatalf("expected asset.import_batch.updated SSE event, got body %q", stream)
	}
}

func readUploadEventStreamUntil(t *testing.T, body io.ReadCloser, cancel context.CancelFunc, markers ...string) string {
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

func TestCompleteUploadSessionCreatesAssetRecords(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)
	store.ImportBatches["import-batch-1"] = assetdomain.ImportBatch{
		ID:         "import-batch-1",
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "upload_session",
		Status:     "pending_review",
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))

	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"import_batch_id":    "import-batch-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	completeRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions/"+sessionID+"/complete", map[string]any{
		"variant_type":  "original",
		"mime_type":     "image/png",
		"locale":        "zh-CN",
		"rights_status": "clear",
		"ai_annotated":  true,
		"width":         1920,
		"height":        1080,
	})
	completeResponse := decodeUploadJSONResponse(t, completeRec)
	if got := completeResponse["status"].(string); got != "uploaded" {
		t.Fatalf("expected uploaded session status, got %q", got)
	}
	if got := completeResponse["asset_id"].(string); got == "" {
		t.Fatalf("expected asset_id in upload complete response, got empty")
	}
	if got := completeResponse["upload_file_id"].(string); got == "" {
		t.Fatalf("expected upload_file_id in upload complete response, got empty")
	}
	if got := completeResponse["variant_id"].(string); got == "" {
		t.Fatalf("expected variant_id in upload complete response, got empty")
	}

	if len(store.MediaAssets) != 1 {
		t.Fatalf("expected 1 media asset, got %d", len(store.MediaAssets))
	}
	for _, mediaAsset := range store.MediaAssets {
		if mediaAsset.ImportBatchID != "import-batch-1" {
			t.Fatalf("expected media asset bound to import batch, got %q", mediaAsset.ImportBatchID)
		}
		if mediaAsset.SourceType != "upload_session" {
			t.Fatalf("expected media asset source_type upload_session, got %q", mediaAsset.SourceType)
		}
		if mediaAsset.Locale != "zh-CN" {
			t.Fatalf("expected media asset locale zh-CN, got %q", mediaAsset.Locale)
		}
	}

	if len(store.UploadFiles) != 1 {
		t.Fatalf("expected 1 upload file, got %d", len(store.UploadFiles))
	}
	if len(store.MediaAssetVariants) != 1 {
		t.Fatalf("expected 1 media asset variant, got %d", len(store.MediaAssetVariants))
	}
	if len(store.ImportBatchItems) != 1 {
		t.Fatalf("expected 1 import batch item, got %d", len(store.ImportBatchItems))
	}
	for _, item := range store.ImportBatchItems {
		if item.Status != "uploaded_pending_match" {
			t.Fatalf("expected uploaded_pending_match item status, got %q", item.Status)
		}
	}
	if got := store.ImportBatches["import-batch-1"].Status; got != "uploaded_pending_match" {
		t.Fatalf("expected import batch status uploaded_pending_match, got %q", got)
	}
}

func TestCreateUploadSessionRejectsUnknownImportBatch(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))

	reqBody, err := json.Marshal(map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"import_batch_id":    "missing-batch",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/upload/sessions", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for unknown import batch, got %d with body %s", rec.Code, rec.Body.String())
	}
}

func TestCompleteUploadSessionCanAttachCandidateToShotExecution(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)
	store.ImportBatches["import-batch-1"] = assetdomain.ImportBatch{
		ID:         "import-batch-1",
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "upload_session",
		Status:     "pending_review",
	}
	store.ShotExecutions["shot-execution-1"] = executiondomain.ShotExecution{
		ID:        "shot-execution-1",
		OrgID:     "org-1",
		ProjectID: "project-1",
		ShotID:    "shot-1",
		Status:    "in_progress",
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, newUploadServiceFromStore(store))

	createRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions", map[string]any{
		"organization_id":    "org-1",
		"project_id":         "project-1",
		"import_batch_id":    "import-batch-1",
		"file_name":          "shot.png",
		"checksum":           "sha256:abc123",
		"size_bytes":         1024,
		"expires_in_seconds": 60,
	})
	createResponse := decodeUploadJSONResponse(t, createRec)
	sessionID := createResponse["session_id"].(string)

	completeRec := performUploadJSONRequest(t, mux, http.MethodPost, "/upload/sessions/"+sessionID+"/complete", map[string]any{
		"shot_execution_id": "shot-execution-1",
		"variant_type":      "original",
		"mime_type":         "image/png",
		"locale":            "zh-CN",
		"rights_status":     "clear",
		"ai_annotated":      true,
		"width":             1920,
		"height":            1080,
	})
	completeResponse := decodeUploadJSONResponse(t, completeRec)
	if got := completeResponse["status"].(string); got != "uploaded" {
		t.Fatalf("expected uploaded session status, got %q", got)
	}
	if got := completeResponse["candidate_asset_id"].(string); got == "" {
		t.Fatalf("expected candidate_asset_id in upload complete response, got empty")
	}
	if got := completeResponse["shot_execution_id"].(string); got != "shot-execution-1" {
		t.Fatalf("expected shot_execution_id shot-execution-1, got %q", got)
	}

	if len(store.CandidateAssets) != 1 {
		t.Fatalf("expected 1 candidate asset, got %d", len(store.CandidateAssets))
	}

	if len(store.ImportBatchItems) != 1 {
		t.Fatalf("expected 1 import batch item, got %d", len(store.ImportBatchItems))
	}
	for _, item := range store.ImportBatchItems {
		if item.Status != "matched_pending_confirm" {
			t.Fatalf("expected matched_pending_confirm item status, got %q", item.Status)
		}
		if item.MatchedShotID != "shot-1" {
			t.Fatalf("expected matched shot id shot-1, got %q", item.MatchedShotID)
		}
	}

	if got := store.ShotExecutions["shot-execution-1"].Status; got != "candidate_ready" {
		t.Fatalf("expected shot execution status candidate_ready, got %q", got)
	}
}

func performUploadJSONRequest(t *testing.T, mux *http.ServeMux, method string, target string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("json.Marshal returned error: %v", err)
		}
	}

	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
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

func decodeUploadJSONResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var response map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	return response
}

func resetSessionStore(store *db.MemoryStore) {
	if store == nil {
		return
	}
	store.UploadSessions = map[string]assetdomain.UploadSession{}
}

func newUploadServiceFromStore(store *db.MemoryStore) *Service {
	return NewService(Dependencies{
		Assets:         store,
		Executions:     store,
		Policy:         policyapp.NewService(store),
		EventPublisher: store.EventPublisher,
	})
}

func TestSessionHandlerDoesNotDependOnRawMemoryStore(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("session_handler.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	if strings.Contains(string(content), "*db.MemoryStore") {
		t.Fatalf("expected upload session handler to avoid raw *db.MemoryStore dependency")
	}
}
