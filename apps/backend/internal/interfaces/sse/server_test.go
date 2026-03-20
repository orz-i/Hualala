package sse

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSSEReplayWithLastEventID(t *testing.T) {
	resetEventStore()
	publishEvent(eventEnvelope{
		EventID:        "evt-1",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"candidate_ready"}`,
	})
	publishEvent(eventEnvelope{
		EventID:        "evt-2",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"submitted_for_review"}`,
	})

	mux := http.NewServeMux()
	RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/sse/events?organization_id=org-1&project_id=project-1", nil)
	req.Header.Set("Last-Event-ID", "evt-1")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", got)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "id: evt-2") {
		t.Fatalf("expected replayed event evt-2, got body %q", body)
	}
	if strings.Contains(body, "id: evt-1") {
		t.Fatalf("did not expect evt-1 to be replayed after Last-Event-ID, got body %q", body)
	}
}

func TestSSEFiltersByOrgAndProject(t *testing.T) {
	resetEventStore()
	publishEvent(eventEnvelope{
		EventID:        "evt-1",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"candidate_ready"}`,
	})
	publishEvent(eventEnvelope{
		EventID:        "evt-2",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-2",
		ProjectID:      "project-2",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-2",
		Payload:        `{"status":"candidate_ready"}`,
	})

	mux := http.NewServeMux()
	RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/sse/events?organization_id=org-1&project_id=project-1", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "id: evt-1") {
		t.Fatalf("expected evt-1 in filtered stream, got body %q", body)
	}
	if strings.Contains(body, "id: evt-2") {
		t.Fatalf("did not expect evt-2 in filtered stream, got body %q", body)
	}
}
