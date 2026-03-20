package upload

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

func resetSessionStore(store *db.MemoryStore) {
	if store == nil {
		return
	}
	store.UploadSessions = map[string]asset.UploadSession{}
}

func RegisterRoutes(mux *http.ServeMux, store *db.MemoryStore) {
	if store == nil {
		store = db.NewMemoryStore()
	}

	mux.HandleFunc("/upload/sessions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			OrganizationID   string `json:"organization_id"`
			ProjectID        string `json:"project_id"`
			FileName         string `json:"file_name"`
			Checksum         string `json:"checksum"`
			SizeBytes        int64  `json:"size_bytes"`
			ExpiresInSeconds int64  `json:"expires_in_seconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		session := createSession(store, request.OrganizationID, request.ProjectID, request.FileName, request.Checksum, request.SizeBytes, request.ExpiresInSeconds)
		publishUploadSessionUpdated(store, session)
		writeSessionResponse(w, http.StatusOK, session)
	})

	mux.HandleFunc("/upload/sessions/", func(w http.ResponseWriter, r *http.Request) {
		sessionID, action := parseSessionPath(r.URL.Path)
		if sessionID == "" {
			http.NotFound(w, r)
			return
		}

		switch {
		case r.Method == http.MethodGet && action == "":
			session, ok := getSession(store, sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeSessionResponse(w, http.StatusOK, session)
		case r.Method == http.MethodPost && action == "retry":
			session, ok := retrySession(store, sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			publishUploadSessionUpdated(store, session)
			writeSessionResponse(w, http.StatusOK, session)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func createSession(store *db.MemoryStore, organizationID string, projectID string, fileName string, checksum string, sizeBytes int64, expiresInSeconds int64) asset.UploadSession {
	now := time.Now().UTC()
	session := asset.UploadSession{
		ID:         store.NextUploadSessionID(),
		OrgID:      organizationID,
		ProjectID:  projectID,
		FileName:   fileName,
		Checksum:   checksum,
		SizeBytes:  sizeBytes,
		RetryCount: 0,
		Status:     "pending",
		ResumeHint: fmt.Sprintf("upload %s from byte 0", fileName),
		CreatedAt:  now,
		ExpiresAt:  now.Add(time.Duration(expiresInSeconds) * time.Second),
	}
	store.UploadSessions[session.ID] = session
	return session
}

func getSession(store *db.MemoryStore, sessionID string) (asset.UploadSession, bool) {
	session, ok := store.UploadSessions[sessionID]
	return session, ok
}

func retrySession(store *db.MemoryStore, sessionID string) (asset.UploadSession, bool) {
	session, ok := store.UploadSessions[sessionID]
	if !ok {
		return asset.UploadSession{}, false
	}
	session.RetryCount++
	session.LastRetryAt = time.Now().UTC()
	session.Status = sessionStatus(session)
	session.ResumeHint = sessionResumeHint(session)
	store.UploadSessions[sessionID] = session
	return session, true
}

func parseSessionPath(path string) (string, string) {
	trimmed := strings.TrimPrefix(path, "/upload/sessions/")
	if trimmed == path || trimmed == "" {
		return "", ""
	}

	parts := strings.Split(strings.Trim(trimmed, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], parts[1]
}

func writeSessionResponse(w http.ResponseWriter, statusCode int, session asset.UploadSession) {
	response := map[string]any{
		"session_id":   session.ID,
		"status":       sessionStatus(session),
		"retry_count":  session.RetryCount,
		"resume_hint":  sessionResumeHint(session),
		"expires_at":   session.ExpiresAt.Format(time.RFC3339),
		"organization": session.OrgID,
		"project_id":   session.ProjectID,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(response)
}

func sessionStatus(session asset.UploadSession) string {
	if !session.ExpiresAt.After(time.Now().UTC()) {
		return "expired"
	}
	return "pending"
}

func sessionResumeHint(session asset.UploadSession) string {
	if sessionStatus(session) == "expired" {
		return "upload session expired; create a retry session to resume upload"
	}
	if session.RetryCount > 0 {
		return fmt.Sprintf("retry from byte 0 for %s", session.FileName)
	}
	return fmt.Sprintf("upload %s from byte 0", session.FileName)
}

func publishUploadSessionUpdated(store *db.MemoryStore, session asset.UploadSession) {
	if store == nil || store.EventPublisher == nil {
		return
	}

	body, err := json.Marshal(map[string]any{
		"session_id":   session.ID,
		"project_id":   session.ProjectID,
		"status":       sessionStatus(session),
		"retry_count":  session.RetryCount,
		"resume_hint":  sessionResumeHint(session),
		"expires_at":   session.ExpiresAt.Format(time.RFC3339),
		"organization": session.OrgID,
	})
	if err != nil {
		return
	}

	store.EventPublisher.Publish(events.Event{
		EventType:      "asset.upload_session.updated",
		OrganizationID: session.OrgID,
		ProjectID:      session.ProjectID,
		ResourceType:   "upload_session",
		ResourceID:     session.ID,
		Payload:        string(body),
	})
}
