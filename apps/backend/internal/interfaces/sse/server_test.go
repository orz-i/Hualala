package sse

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/platform/events"
)

func TestSSEReplayWithLastEventID(t *testing.T) {
	publisher := events.NewPublisher()
	resetEventStore(publisher)
	publishEvent(publisher, events.Event{
		ID:             "evt-1",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"candidate_ready"}`,
	})
	publishEvent(publisher, events.Event{
		ID:             "evt-2",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"submitted_for_review"}`,
	})

	mux := http.NewServeMux()
	RegisterRoutes(mux, publisher)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/sse/events?organization_id=org-1&project_id=project-1", nil).WithContext(ctx)
	req.Header.Set("Last-Event-ID", "evt-1")
	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		mux.ServeHTTP(rec, req)
		close(done)
	}()

	stream := waitForRecorderBody(t, rec, "id: evt-2")
	cancel()
	<-done

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", got)
	}
	if !strings.Contains(stream, "id: evt-2") {
		t.Fatalf("expected replayed event evt-2, got body %q", stream)
	}
	if strings.Contains(stream, "id: evt-1") {
		t.Fatalf("did not expect evt-1 to be replayed after Last-Event-ID, got body %q", stream)
	}
}

func TestSSEFiltersByOrgAndProject(t *testing.T) {
	publisher := events.NewPublisher()
	resetEventStore(publisher)
	publishEvent(publisher, events.Event{
		ID:             "evt-1",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-1",
		Payload:        `{"status":"candidate_ready"}`,
	})
	publishEvent(publisher, events.Event{
		ID:             "evt-2",
		EventType:      "shot.execution.updated",
		OrganizationID: "org-2",
		ProjectID:      "project-2",
		ResourceType:   "shot_execution",
		ResourceID:     "shot-execution-2",
		Payload:        `{"status":"candidate_ready"}`,
	})

	mux := http.NewServeMux()
	RegisterRoutes(mux, publisher)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/sse/events?organization_id=org-1&project_id=project-1", nil).WithContext(ctx)
	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		mux.ServeHTTP(rec, req)
		close(done)
	}()

	stream := waitForRecorderBody(t, rec, "id: evt-1")
	cancel()
	<-done

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(stream, "id: evt-1") {
		t.Fatalf("expected evt-1 in filtered stream, got body %q", stream)
	}
	if strings.Contains(stream, "id: evt-2") {
		t.Fatalf("did not expect evt-2 in filtered stream, got body %q", stream)
	}
}

func TestSSEStreamsFutureEventsAfterReplay(t *testing.T) {
	publisher := events.NewPublisher()
	resetEventStore(publisher)

	mux := http.NewServeMux()
	RegisterRoutes(mux, publisher)
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/sse/events?organization_id=org-1&project_id=project-1", nil)
	if err != nil {
		t.Fatalf("NewRequestWithContext returned error: %v", err)
	}

	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	done := make(chan string, 1)
	go func() {
		reader := bufio.NewReader(resp.Body)
		var lines strings.Builder
		for i := 0; i < 3; i++ {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				done <- lines.String()
				return
			}
			lines.WriteString(line)
		}
		done <- lines.String()
	}()

	time.Sleep(50 * time.Millisecond)
	publishEvent(publisher, events.Event{
		ID:             "evt-live-1",
		EventType:      "budget.updated",
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		ResourceType:   "budget",
		ResourceID:     "budget-1",
		Payload:        `{"limit_cents":900}`,
	})

	select {
	case got := <-done:
		if !strings.Contains(got, "id: evt-live-1") {
			t.Fatalf("expected live stream to emit evt-live-1, got %q", got)
		}
		if !strings.Contains(got, "event: budget.updated") {
			t.Fatalf("expected live stream to emit budget.updated, got %q", got)
		}
	case <-ctx.Done():
		t.Fatal("expected live SSE event before request timeout")
	}
}

func TestSSEEmitsHeartbeatWhileConnectionIsIdle(t *testing.T) {
	publisher := events.NewPublisher()
	resetEventStore(publisher)

	mux := http.NewServeMux()
	registerRoutesWithHeartbeatInterval(mux, publisher, 20*time.Millisecond)
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/sse/events?organization_id=org-1&project_id=project-1", nil)
	if err != nil {
		t.Fatalf("NewRequestWithContext returned error: %v", err)
	}

	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	line, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("ReadString returned error: %v", err)
	}

	if strings.TrimSpace(line) != ": keep-alive" {
		t.Fatalf("expected heartbeat frame, got %q", line)
	}
}

func waitForRecorderBody(t *testing.T, recorder *httptest.ResponseRecorder, marker string) string {
	t.Helper()

	deadline := time.After(500 * time.Millisecond)
	tick := time.NewTicker(5 * time.Millisecond)
	defer tick.Stop()

	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for recorder body marker %q in %q", marker, recorder.Body.String())
		case <-tick.C:
			body := recorder.Body.String()
			if strings.Contains(body, marker) {
				return body
			}
		}
	}
}
