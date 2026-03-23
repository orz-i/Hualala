package connect

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
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
			body:           []byte(`{"organization_id":"` + connectTestOrgID + `","project_id":"project-1","file_name":"shot.png","checksum":"sha256:abc123","size_bytes":1024,"expires_in_seconds":1}`),
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

				req, err := http.NewRequestWithContext(
					ctx,
					tc.method,
					server.URL+tc.target,
					bytes.NewReader(tc.body),
				)
				if err != nil {
					t.Fatalf("http.NewRequestWithContext returned error: %v", err)
				}
				if tc.contentType != "" {
					req.Header.Set("Content-Type", tc.contentType)
				}
				req.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))

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
			if tc.target == "/upload/sessions" {
				req.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
			}

			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Fatalf("expected status %d, got %d", tc.expectedStatus, rec.Code)
			}
		})
	}
}
