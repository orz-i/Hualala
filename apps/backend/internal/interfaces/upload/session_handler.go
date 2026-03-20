package upload

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

type uploadSession struct {
	SessionID      string    `json:"session_id"`
	OrganizationID string    `json:"organization_id"`
	ProjectID      string    `json:"project_id"`
	FileName       string    `json:"file_name"`
	Checksum       string    `json:"checksum"`
	SizeBytes      int64     `json:"size_bytes"`
	RetryCount     int       `json:"retry_count"`
	CreatedAt      time.Time `json:"created_at"`
	ExpiresAt      time.Time `json:"expires_at"`
}

var (
	sessionStoreMu sync.RWMutex
	sessionStore   = map[string]uploadSession{}
	nextSessionID  = 1
)

func resetSessionStore() {
	sessionStoreMu.Lock()
	defer sessionStoreMu.Unlock()

	sessionStore = map[string]uploadSession{}
	nextSessionID = 1
}

func RegisterRoutes(mux *http.ServeMux) {
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

		session := createSession(request.OrganizationID, request.ProjectID, request.FileName, request.Checksum, request.SizeBytes, request.ExpiresInSeconds)
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
			session, ok := getSession(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeSessionResponse(w, http.StatusOK, session)
		case r.Method == http.MethodPost && action == "retry":
			session, ok := retrySession(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeSessionResponse(w, http.StatusOK, session)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func createSession(organizationID string, projectID string, fileName string, checksum string, sizeBytes int64, expiresInSeconds int64) uploadSession {
	sessionStoreMu.Lock()
	defer sessionStoreMu.Unlock()

	now := time.Now().UTC()
	session := uploadSession{
		SessionID:      fmt.Sprintf("upload-session-%d", nextSessionID),
		OrganizationID: organizationID,
		ProjectID:      projectID,
		FileName:       fileName,
		Checksum:       checksum,
		SizeBytes:      sizeBytes,
		RetryCount:     0,
		CreatedAt:      now,
		ExpiresAt:      now.Add(time.Duration(expiresInSeconds) * time.Second),
	}
	nextSessionID++
	sessionStore[session.SessionID] = session
	return session
}

func getSession(sessionID string) (uploadSession, bool) {
	sessionStoreMu.RLock()
	defer sessionStoreMu.RUnlock()

	session, ok := sessionStore[sessionID]
	return session, ok
}

func retrySession(sessionID string) (uploadSession, bool) {
	sessionStoreMu.Lock()
	defer sessionStoreMu.Unlock()

	session, ok := sessionStore[sessionID]
	if !ok {
		return uploadSession{}, false
	}
	session.RetryCount++
	sessionStore[sessionID] = session
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

func writeSessionResponse(w http.ResponseWriter, statusCode int, session uploadSession) {
	response := map[string]any{
		"session_id":   session.SessionID,
		"status":       sessionStatus(session),
		"retry_count":  session.RetryCount,
		"resume_hint":  sessionResumeHint(session),
		"expires_at":   session.ExpiresAt.Format(time.RFC3339),
		"organization": session.OrganizationID,
		"project_id":   session.ProjectID,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(response)
}

func sessionStatus(session uploadSession) string {
	if !session.ExpiresAt.After(time.Now().UTC()) {
		return "expired"
	}
	return "pending"
}

func sessionResumeHint(session uploadSession) string {
	if sessionStatus(session) == "expired" {
		return "upload session expired; create a retry session to resume upload"
	}
	if session.RetryCount > 0 {
		return fmt.Sprintf("retry from byte 0 for %s", session.FileName)
	}
	return fmt.Sprintf("upload %s from byte 0", session.FileName)
}
