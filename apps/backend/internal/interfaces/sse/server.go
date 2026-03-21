package sse

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/events"
)

const defaultHeartbeatInterval = 15 * time.Second

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

func RegisterRoutes(mux *http.ServeMux, publisher *events.Publisher, authorizer authz.Authorizer) {
	registerRoutesWithHeartbeatInterval(mux, publisher, authorizer, defaultHeartbeatInterval)
}

func registerRoutesWithHeartbeatInterval(mux *http.ServeMux, publisher *events.Publisher, authorizer authz.Authorizer, heartbeatInterval time.Duration) {
	if publisher == nil {
		publisher = events.NewPublisher()
	}

	mux.HandleFunc("/sse/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		principal, err := authorizer.ResolvePrincipal(r.Context(), authz.ResolvePrincipalInput{
			HeaderOrgID:  r.Header.Get("X-Hualala-Org-Id"),
			HeaderUserID: r.Header.Get("X-Hualala-User-Id"),
			CookieHeader: r.Header.Get("Cookie"),
		})
		if err != nil {
			writeSSEError(w, err)
			return
		}

		organizationID := strings.TrimSpace(r.URL.Query().Get("organization_id"))
		if organizationID == "" {
			organizationID = principal.OrgID
		}
		if organizationID != principal.OrgID {
			writeSSEError(w, fmt.Errorf("permission denied: organization does not match current session"))
			return
		}
		projectID := strings.TrimSpace(r.URL.Query().Get("project_id"))
		lastEventID := r.Header.Get("Last-Event-ID")
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "sse: streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		for _, event := range listReplayEvents(publisher, organizationID, projectID, lastEventID) {
			writeEvent(w, event)
			flusher.Flush()
		}

		stream, unsubscribe := publisher.Subscribe(organizationID, projectID)
		defer unsubscribe()

		ticker := time.NewTicker(heartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case event := <-stream:
				writeEvent(w, event)
				flusher.Flush()
			case <-ticker.C:
				_, _ = fmt.Fprint(w, ": keep-alive\n\n")
				flusher.Flush()
			}
		}
	})
}

func listReplayEvents(publisher *events.Publisher, organizationID string, projectID string, lastEventID string) []events.Event {
	if publisher == nil {
		return nil
	}
	return publisher.List(organizationID, projectID, lastEventID)
}

func writeEvent(w http.ResponseWriter, event events.Event) {
	_, _ = fmt.Fprintf(w, "id: %s\n", event.ID)
	_, _ = fmt.Fprintf(w, "event: %s\n", event.EventType)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", event.Payload)
}

func writeSSEError(w http.ResponseWriter, err error) {
	if err == nil {
		http.Error(w, "sse: unknown error", http.StatusInternalServerError)
		return
	}
	if strings.Contains(err.Error(), "unauthenticated") {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if strings.Contains(err.Error(), "permission denied") {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	http.Error(w, err.Error(), http.StatusBadRequest)
}
