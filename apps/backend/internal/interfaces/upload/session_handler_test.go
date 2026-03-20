package upload

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hualala/apps/backend/internal/interfaces/sse"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestCreateAndRetryUploadSession(t *testing.T) {
	store := db.NewMemoryStore()
	resetSessionStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, store)

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
	RegisterRoutes(mux, store)

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
	RegisterRoutes(muxA, storeA)
	muxB := http.NewServeMux()
	RegisterRoutes(muxB, storeB)

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
	RegisterRoutes(mux, store)
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

	sseReq := httptest.NewRequest(http.MethodGet, "/sse/events?organization_id=org-1&project_id=project-1", nil)
	sseRec := httptest.NewRecorder()
	mux.ServeHTTP(sseRec, sseReq)

	if sseRec.Code != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseRec.Code)
	}

	body, err := io.ReadAll(sseRec.Body)
	if err != nil {
		t.Fatalf("io.ReadAll returned error: %v", err)
	}
	stream := string(body)
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
