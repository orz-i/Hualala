package sse

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
)

type eventEnvelope struct {
	EventID        string
	EventType      string
	OrganizationID string
	ProjectID      string
	ResourceType   string
	ResourceID     string
	Payload        string
}

var (
	eventStoreMu sync.RWMutex
	eventStore   []eventEnvelope
)

func resetEventStore() {
	eventStoreMu.Lock()
	defer eventStoreMu.Unlock()

	eventStore = nil
}

func publishEvent(event eventEnvelope) {
	eventStoreMu.Lock()
	defer eventStoreMu.Unlock()

	eventStore = append(eventStore, event)
}

func RegisterRoutes(mux *http.ServeMux) {
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

		for _, event := range listReplayEvents(organizationID, projectID, lastEventID) {
			_, _ = fmt.Fprintf(w, "id: %s\n", event.EventID)
			_, _ = fmt.Fprintf(w, "event: %s\n", event.EventType)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", event.Payload)
		}
	})
}

func listReplayEvents(organizationID string, projectID string, lastEventID string) []eventEnvelope {
	eventStoreMu.RLock()
	defer eventStoreMu.RUnlock()

	replayEvents := make([]eventEnvelope, 0, len(eventStore))
	reachedLastEvent := lastEventID == ""
	for _, event := range eventStore {
		if !reachedLastEvent {
			if strings.EqualFold(event.EventID, lastEventID) {
				reachedLastEvent = true
			}
			continue
		}
		if organizationID != "" && event.OrganizationID != organizationID {
			continue
		}
		if projectID != "" && event.ProjectID != projectID {
			continue
		}
		replayEvents = append(replayEvents, event)
	}
	return replayEvents
}
