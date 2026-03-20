package upload

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/application/policyapp"
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
	policyService := policyapp.NewService(store)

	mux.HandleFunc("/upload/sessions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			OrganizationID   string `json:"organization_id"`
			ProjectID        string `json:"project_id"`
			ImportBatchID    string `json:"import_batch_id"`
			FileName         string `json:"file_name"`
			Checksum         string `json:"checksum"`
			SizeBytes        int64  `json:"size_bytes"`
			ExpiresInSeconds int64  `json:"expires_in_seconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(request.ImportBatchID) != "" {
			if _, ok := store.ImportBatches[strings.TrimSpace(request.ImportBatchID)]; !ok {
				http.Error(w, "upload: import_batch_id not found", http.StatusBadRequest)
				return
			}
		}

		session := createSession(store, request.OrganizationID, request.ProjectID, request.ImportBatchID, request.FileName, request.Checksum, request.SizeBytes, request.ExpiresInSeconds)
		if err := store.Persist(r.Context()); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		publishUploadSessionUpdated(store, session)
		writeSessionResponse(w, http.StatusOK, store, policyService, session)
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
			writeSessionResponse(w, http.StatusOK, store, policyService, session)
		case r.Method == http.MethodPost && action == "retry":
			session, ok := retrySession(store, policyService, sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			if err := store.Persist(r.Context()); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			publishUploadSessionUpdated(store, session)
			writeSessionResponse(w, http.StatusOK, store, policyService, session)
		case r.Method == http.MethodPost && action == "complete":
			var request struct {
				ShotExecutionID string `json:"shot_execution_id"`
				VariantType     string `json:"variant_type"`
				MimeType        string `json:"mime_type"`
				Locale          string `json:"locale"`
				RightsStatus    string `json:"rights_status"`
				AIAnnotated     bool   `json:"ai_annotated"`
				Width           int    `json:"width"`
				Height          int    `json:"height"`
			}
			if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			session, ok := completeSession(store, policyService, sessionID, request.ShotExecutionID, request.VariantType, request.MimeType, request.Locale, request.RightsStatus, request.AIAnnotated, request.Width, request.Height)
			if !ok {
				http.NotFound(w, r)
				return
			}
			if err := store.Persist(r.Context()); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			publishUploadSessionUpdated(store, session)
			writeSessionResponse(w, http.StatusOK, store, policyService, session)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func createSession(store *db.MemoryStore, organizationID string, projectID string, importBatchID string, fileName string, checksum string, sizeBytes int64, expiresInSeconds int64) asset.UploadSession {
	now := time.Now().UTC()
	session := asset.UploadSession{
		ID:            store.NextUploadSessionID(),
		OrgID:         organizationID,
		ProjectID:     projectID,
		ImportBatchID: strings.TrimSpace(importBatchID),
		FileName:      fileName,
		Checksum:      checksum,
		SizeBytes:     sizeBytes,
		RetryCount:    0,
		Status:        "pending",
		ResumeHint:    fmt.Sprintf("upload %s from byte 0", fileName),
		CreatedAt:     now,
		ExpiresAt:     now.Add(time.Duration(expiresInSeconds) * time.Second),
	}
	store.UploadSessions[session.ID] = session
	return session
}

func getSession(store *db.MemoryStore, sessionID string) (asset.UploadSession, bool) {
	session, ok := store.UploadSessions[sessionID]
	return session, ok
}

func retrySession(store *db.MemoryStore, policy *policyapp.Service, sessionID string) (asset.UploadSession, bool) {
	session, ok := store.UploadSessions[sessionID]
	if !ok {
		return asset.UploadSession{}, false
	}
	decision := policy.EvaluateUploadResumeAllowed(session)
	if !decision.CanRetry {
		return asset.UploadSession{}, false
	}
	session.RetryCount++
	session.LastRetryAt = time.Now().UTC()
	session.Status = sessionStatus(session)
	session.ResumeHint = policy.EvaluateUploadResumeAllowed(session).ResumeHint
	store.UploadSessions[sessionID] = session
	return session, true
}

func completeSession(store *db.MemoryStore, policy *policyapp.Service, sessionID string, shotExecutionID string, variantType string, mimeType string, locale string, rightsStatus string, aiAnnotated bool, width int, height int) (asset.UploadSession, bool) {
	session, ok := store.UploadSessions[sessionID]
	if !ok {
		return asset.UploadSession{}, false
	}
	if !policy.EvaluateUploadResumeAllowed(session).CanComplete {
		return asset.UploadSession{}, false
	}
	shotExecutionID = strings.TrimSpace(shotExecutionID)
	var shotExecution assetLikeShotExecution
	if shotExecutionID != "" {
		record, ok := store.ShotExecutions[shotExecutionID]
		if !ok {
			return asset.UploadSession{}, false
		}
		shotExecution = assetLikeShotExecution{
			ID:        record.ID,
			ProjectID: record.ProjectID,
			OrgID:     record.OrgID,
			ShotID:    record.ShotID,
			Status:    record.Status,
		}
	}
	now := time.Now().UTC()
	session.Status = "uploaded"
	session.ResumeHint = fmt.Sprintf("upload complete for %s", session.FileName)
	store.UploadSessions[sessionID] = session

	mediaAsset := asset.MediaAsset{
		ID:            store.NextMediaAssetID(),
		OrgID:         session.OrgID,
		ProjectID:     session.ProjectID,
		ImportBatchID: session.ImportBatchID,
		SourceType:    "upload_session",
		Locale:        strings.TrimSpace(locale),
		RightsStatus:  strings.TrimSpace(rightsStatus),
		AIAnnotated:   aiAnnotated,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if mediaAsset.RightsStatus == "" {
		mediaAsset.RightsStatus = "pending"
	}
	store.MediaAssets[mediaAsset.ID] = mediaAsset

	uploadFile := asset.UploadFile{
		ID:              store.NextUploadFileID(),
		UploadSessionID: session.ID,
		FileName:        session.FileName,
		MimeType:        strings.TrimSpace(mimeType),
		Checksum:        session.Checksum,
		SizeBytes:       session.SizeBytes,
		CreatedAt:       now,
	}
	store.UploadFiles[uploadFile.ID] = uploadFile

	variant := asset.MediaAssetVariant{
		ID:           store.NextMediaAssetVariantID(),
		AssetID:      mediaAsset.ID,
		UploadFileID: uploadFile.ID,
		VariantType:  strings.TrimSpace(variantType),
		MimeType:     strings.TrimSpace(mimeType),
		Width:        width,
		Height:       height,
		CreatedAt:    now,
	}
	store.MediaAssetVariants[variant.ID] = variant

	if strings.TrimSpace(session.ImportBatchID) != "" {
		itemStatus := "uploaded_pending_match"
		matchedShotID := ""
		if shotExecutionID != "" {
			candidate := asset.CandidateAsset{
				ID:              store.NextCandidateAssetID(),
				ShotExecutionID: shotExecutionID,
				AssetID:         mediaAsset.ID,
				SourceRunID:     "",
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			store.CandidateAssets[candidate.ID] = candidate
			itemStatus = "matched_pending_confirm"
			matchedShotID = shotExecution.ShotID
			record := store.ShotExecutions[shotExecutionID]
			record.Status = "candidate_ready"
			record.UpdatedAt = now
			store.ShotExecutions[shotExecutionID] = record
		}

		item := asset.ImportBatchItem{
			ID:            store.NextImportBatchItemID(),
			ImportBatchID: session.ImportBatchID,
			Status:        itemStatus,
			MatchedShotID: matchedShotID,
			AssetID:       mediaAsset.ID,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		store.ImportBatchItems[item.ID] = item
		if batch, ok := store.ImportBatches[session.ImportBatchID]; ok {
			batch.Status = itemStatus
			batch.UpdatedAt = now
			store.ImportBatches[session.ImportBatchID] = batch
		}
	}

	return session, true
}

type assetLikeShotExecution struct {
	ID        string
	ProjectID string
	OrgID     string
	ShotID    string
	Status    string
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

func writeSessionResponse(w http.ResponseWriter, statusCode int, store *db.MemoryStore, policy *policyapp.Service, session asset.UploadSession) {
	decision := policy.EvaluateUploadResumeAllowed(session)
	response := map[string]any{
		"session_id":      session.ID,
		"import_batch_id": session.ImportBatchID,
		"status":          sessionStatus(session),
		"retry_count":     session.RetryCount,
		"resume_hint":     decision.ResumeHint,
		"expires_at":      session.ExpiresAt.Format(time.RFC3339),
		"organization":    session.OrgID,
		"project_id":      session.ProjectID,
	}
	uploadFileID, assetID, variantID, candidateAssetID, shotExecutionID := findSessionArtifacts(store, session.ID)
	if uploadFileID != "" {
		response["upload_file_id"] = uploadFileID
	}
	if assetID != "" {
		response["asset_id"] = assetID
	}
	if variantID != "" {
		response["variant_id"] = variantID
	}
	if candidateAssetID != "" {
		response["candidate_asset_id"] = candidateAssetID
	}
	if shotExecutionID != "" {
		response["shot_execution_id"] = shotExecutionID
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(response)
}

func sessionStatus(session asset.UploadSession) string {
	if strings.TrimSpace(session.Status) == "uploaded" {
		return "uploaded"
	}
	if !session.ExpiresAt.After(time.Now().UTC()) {
		return "expired"
	}
	return "pending"
}

func publishUploadSessionUpdated(store *db.MemoryStore, session asset.UploadSession) {
	if store == nil || store.EventPublisher == nil {
		return
	}
	decision := policyapp.NewService(store).EvaluateUploadResumeAllowed(session)

	body, err := json.Marshal(map[string]any{
		"session_id":   session.ID,
		"project_id":   session.ProjectID,
		"status":       sessionStatus(session),
		"retry_count":  session.RetryCount,
		"resume_hint":  decision.ResumeHint,
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

func findSessionArtifacts(store *db.MemoryStore, sessionID string) (string, string, string, string, string) {
	if store == nil {
		return "", "", "", "", ""
	}

	uploadFileID := ""
	for _, uploadFile := range store.UploadFiles {
		if uploadFile.UploadSessionID == sessionID {
			uploadFileID = uploadFile.ID
			break
		}
	}

	assetID := ""
	variantID := ""
	if uploadFileID != "" {
		for _, variant := range store.MediaAssetVariants {
			if variant.UploadFileID == uploadFileID {
				variantID = variant.ID
				assetID = variant.AssetID
				break
			}
		}
	}

	candidateAssetID := ""
	shotExecutionID := ""
	if assetID != "" {
		for _, candidate := range store.CandidateAssets {
			if candidate.AssetID == assetID {
				candidateAssetID = candidate.ID
				shotExecutionID = candidate.ShotExecutionID
				break
			}
		}
	}

	return uploadFileID, assetID, variantID, candidateAssetID, shotExecutionID
}
