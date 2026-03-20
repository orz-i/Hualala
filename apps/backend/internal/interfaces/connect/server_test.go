package connect

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRegisterRoutes(t *testing.T) {
	mux := http.NewServeMux()
	RegisterRoutes(mux)

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
