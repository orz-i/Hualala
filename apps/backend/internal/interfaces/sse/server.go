package sse

import (
	"fmt"
	"net/http"

	"github.com/hualala/apps/backend/internal/platform/events"
)

func resetEventStore(publisher *events.Publisher) {
	if publisher != nil {
		publisher.Reset()
	}
}

func publishEvent(publisher *events.Publisher, event events.Event) {
	if publisher != nil {
		publisher.Publish(event)
	}
}

func RegisterRoutes(mux *http.ServeMux, publisher *events.Publisher) {
	if publisher == nil {
		publisher = events.NewPublisher()
	}

	mux.HandleFunc("/sse/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		organizationID := r.URL.Query().Get("organization_id")
		projectID := r.URL.Query().Get("project_id")
		lastEventID := r.Header.Get("Last-Event-ID")

		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)

		for _, event := range listReplayEvents(publisher, organizationID, projectID, lastEventID) {
			_, _ = fmt.Fprintf(w, "id: %s\n", event.ID)
			_, _ = fmt.Fprintf(w, "event: %s\n", event.EventType)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", event.Payload)
		}
	})
}

func listReplayEvents(publisher *events.Publisher, organizationID string, projectID string, lastEventID string) []events.Event {
	if publisher == nil {
		return nil
	}
	return publisher.List(organizationID, projectID, lastEventID)
}
