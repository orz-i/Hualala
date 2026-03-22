package upload

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/application/policyapp"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/events"
)

const defaultRetrySessionTTL = time.Minute

type Service struct {
	assets         db.AssetRepository
	executions     db.ExecutionRepository
	policy         *policyapp.Service
	authorizer     authz.Authorizer
	eventPublisher *events.Publisher
}

type Dependencies struct {
	Assets         db.AssetRepository
	Executions     db.ExecutionRepository
	Policy         *policyapp.Service
	Authorizer     authz.Authorizer
	EventPublisher *events.Publisher
}

func NewService(deps Dependencies) *Service {
	return &Service{
		assets:         deps.Assets,
		executions:     deps.Executions,
		policy:         deps.Policy,
		authorizer:     deps.Authorizer,
		eventPublisher: deps.EventPublisher,
	}
}

func RegisterRoutes(mux *http.ServeMux, service *Service) {
	if service == nil {
		return
	}

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

		principal, err := service.resolvePrincipal(r)
		if err != nil {
			writeUploadError(w, err)
			return
		}
		session, err := service.CreateSession(r, principal, request.OrganizationID, request.ProjectID, request.ImportBatchID, request.FileName, request.Checksum, request.SizeBytes, request.ExpiresInSeconds)
		if err != nil {
			writeUploadError(w, err)
			return
		}
		service.publishUploadSessionUpdated(r.Context(), session)
		service.publishImportBatchUpdated(r.Context(), session.ImportBatchID, "upload_session.created", session.ID)
		service.writeSessionResponse(w, http.StatusOK, session)
	})

	mux.HandleFunc("/upload/sessions/", func(w http.ResponseWriter, r *http.Request) {
		sessionID, action := parseSessionPath(r.URL.Path)
		if sessionID == "" {
			http.NotFound(w, r)
			return
		}

		switch {
		case r.Method == http.MethodGet && action == "":
			session, ok := service.GetSession(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			if err := service.ensureSessionAccess(r, session.OrgID); err != nil {
				writeUploadError(w, err)
				return
			}
			service.writeSessionResponse(w, http.StatusOK, session)
		case r.Method == http.MethodPost && action == "retry":
			session, ok := service.GetSession(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			if err := service.ensureSessionAccess(r, session.OrgID); err != nil {
				writeUploadError(w, err)
				return
			}
			session, err := service.RetrySession(r, sessionID)
			if err != nil {
				if strings.Contains(err.Error(), "not found") {
					http.NotFound(w, r)
					return
				}
				writeUploadError(w, err)
				return
			}
			service.publishUploadSessionUpdated(r.Context(), session)
			service.publishImportBatchUpdated(r.Context(), session.ImportBatchID, "upload_session.retried", session.ID)
			service.writeSessionResponse(w, http.StatusOK, session)
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
			session, ok := service.GetSession(sessionID)
			if !ok {
				http.NotFound(w, r)
				return
			}
			if err := service.ensureSessionAccess(r, session.OrgID); err != nil {
				writeUploadError(w, err)
				return
			}
			session, err := service.CompleteSession(r, sessionID, request.ShotExecutionID, request.VariantType, request.MimeType, request.Locale, request.RightsStatus, request.AIAnnotated, request.Width, request.Height)
			if err != nil {
				if strings.Contains(err.Error(), "not found") {
					http.NotFound(w, r)
					return
				}
				writeUploadError(w, err)
				return
			}
			service.publishUploadSessionUpdated(r.Context(), session)
			service.publishImportBatchUpdated(r.Context(), session.ImportBatchID, "upload_session.completed", session.ID)
			service.writeSessionResponse(w, http.StatusOK, session)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func (s *Service) CreateSession(r *http.Request, principal authz.Principal, organizationID string, projectID string, importBatchID string, fileName string, checksum string, sizeBytes int64, expiresInSeconds int64) (asset.UploadSession, error) {
	if s == nil || s.assets == nil {
		return asset.UploadSession{}, fmt.Errorf("upload: asset repository is required")
	}
	if strings.TrimSpace(principal.OrgID) == "" {
		return asset.UploadSession{}, fmt.Errorf("unauthenticated: active session not found")
	}
	organizationID = strings.TrimSpace(organizationID)
	if organizationID != "" && organizationID != principal.OrgID {
		return asset.UploadSession{}, fmt.Errorf("permission denied: upload session org override is invalid")
	}
	if strings.TrimSpace(importBatchID) != "" {
		importBatch, ok := s.assets.GetImportBatch(strings.TrimSpace(importBatchID))
		if !ok {
			return asset.UploadSession{}, fmt.Errorf("upload: import_batch_id not found")
		}
		if strings.TrimSpace(importBatch.OrgID) != principal.OrgID {
			return asset.UploadSession{}, fmt.Errorf("permission denied: import batch does not belong to current org")
		}
	}

	now := time.Now().UTC()
	session := asset.UploadSession{
		ID:            s.assets.GenerateUploadSessionID(),
		OrgID:         principal.OrgID,
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
	if err := s.assets.SaveUploadSession(r.Context(), session); err != nil {
		return asset.UploadSession{}, err
	}
	return session, nil
}

func (s *Service) resolvePrincipal(r *http.Request) (authz.Principal, error) {
	if s == nil {
		return authz.Principal{}, fmt.Errorf("unauthenticated: upload service is required")
	}
	return s.authorizer.ResolvePrincipal(r.Context(), authz.ResolvePrincipalInput{
		HeaderOrgID:  r.Header.Get("X-Hualala-Org-Id"),
		HeaderUserID: r.Header.Get("X-Hualala-User-Id"),
		CookieHeader: r.Header.Get("Cookie"),
	})
}

func (s *Service) ensureSessionAccess(r *http.Request, organizationID string) error {
	principal, err := s.resolvePrincipal(r)
	if err != nil {
		return err
	}
	if strings.TrimSpace(organizationID) != "" && strings.TrimSpace(organizationID) != principal.OrgID {
		return fmt.Errorf("permission denied: upload session does not belong to current org")
	}
	return nil
}

func (s *Service) GetSession(sessionID string) (asset.UploadSession, bool) {
	if s == nil || s.assets == nil {
		return asset.UploadSession{}, false
	}
	return s.assets.GetUploadSession(sessionID)
}

func (s *Service) RetrySession(r *http.Request, sessionID string) (asset.UploadSession, error) {
	session, ok := s.GetSession(sessionID)
	if !ok {
		return asset.UploadSession{}, fmt.Errorf("upload: session not found")
	}
	decision := s.evaluateUploadResumeAllowed(session)
	if !decision.CanRetry {
		return asset.UploadSession{}, fmt.Errorf("upload: session cannot be retried")
	}
	now := time.Now().UTC()
	retryAnchor := session.LastRetryAt
	if retryAnchor.IsZero() {
		retryAnchor = session.CreatedAt
	}
	session.RetryCount++
	if !session.ExpiresAt.After(now) {
		retryWindow := session.ExpiresAt.Sub(retryAnchor)
		if retryWindow <= 0 {
			retryWindow = defaultRetrySessionTTL
		}
		session.ExpiresAt = now.Add(retryWindow)
	}
	session.LastRetryAt = now
	session.Status = sessionStatus(session)
	session.ResumeHint = s.evaluateUploadResumeAllowed(session).ResumeHint
	if err := s.assets.SaveUploadSession(r.Context(), session); err != nil {
		return asset.UploadSession{}, err
	}
	return session, nil
}

func (s *Service) CompleteSession(r *http.Request, sessionID string, shotExecutionID string, variantType string, mimeType string, locale string, rightsStatus string, aiAnnotated bool, width int, height int) (asset.UploadSession, error) {
	if s == nil || s.assets == nil {
		return asset.UploadSession{}, fmt.Errorf("upload: asset repository is required")
	}

	session, ok := s.assets.GetUploadSession(sessionID)
	if !ok {
		return asset.UploadSession{}, fmt.Errorf("upload: session not found")
	}
	if !s.evaluateUploadResumeAllowed(session).CanComplete {
		return asset.UploadSession{}, fmt.Errorf("upload: session cannot be completed")
	}

	shotExecutionID = strings.TrimSpace(shotExecutionID)
	var shotExecution execution.ShotExecution
	if shotExecutionID != "" {
		record, ok := s.executions.GetShotExecution(shotExecutionID)
		if !ok {
			return asset.UploadSession{}, fmt.Errorf("upload: shot execution not found")
		}
		shotExecution = record
	}

	now := time.Now().UTC()
	session.Status = "uploaded"
	session.ResumeHint = fmt.Sprintf("upload complete for %s", session.FileName)
	if err := s.assets.SaveUploadSession(r.Context(), session); err != nil {
		return asset.UploadSession{}, err
	}

	mediaAsset := asset.MediaAsset{
		ID:            s.assets.GenerateMediaAssetID(),
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
		mediaAsset.RightsStatus = "unknown"
	}
	if err := s.assets.SaveMediaAsset(r.Context(), mediaAsset); err != nil {
		return asset.UploadSession{}, err
	}

	uploadFile := asset.UploadFile{
		ID:              s.assets.GenerateUploadFileID(),
		UploadSessionID: session.ID,
		FileName:        session.FileName,
		MimeType:        strings.TrimSpace(mimeType),
		Checksum:        session.Checksum,
		SizeBytes:       session.SizeBytes,
		CreatedAt:       now,
	}
	if err := s.assets.SaveUploadFile(r.Context(), uploadFile); err != nil {
		return asset.UploadSession{}, err
	}

	variant := asset.MediaAssetVariant{
		ID:           s.assets.GenerateMediaAssetVariantID(),
		AssetID:      mediaAsset.ID,
		UploadFileID: uploadFile.ID,
		VariantType:  strings.TrimSpace(variantType),
		MimeType:     strings.TrimSpace(mimeType),
		Width:        width,
		Height:       height,
		CreatedAt:    now,
	}
	if err := s.assets.SaveMediaAssetVariant(r.Context(), variant); err != nil {
		return asset.UploadSession{}, err
	}

	if strings.TrimSpace(session.ImportBatchID) != "" {
		itemStatus := "uploaded_pending_match"
		matchedShotID := ""
		candidateAssetID := ""
		if shotExecutionID != "" {
			candidate := asset.CandidateAsset{
				ID:              s.assets.GenerateCandidateAssetID(),
				ShotExecutionID: shotExecutionID,
				AssetID:         mediaAsset.ID,
				SourceRunID:     "",
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			if err := s.assets.SaveCandidateAsset(r.Context(), candidate); err != nil {
				return asset.UploadSession{}, err
			}
			candidateAssetID = candidate.ID
			itemStatus = "matched_pending_confirm"
			matchedShotID = shotExecution.ShotID
			shotExecution.Status = "candidate_ready"
			shotExecution.UpdatedAt = now
			if err := s.executions.SaveShotExecution(r.Context(), shotExecution); err != nil {
				return asset.UploadSession{}, err
			}
		}

		item := asset.ImportBatchItem{
			ID:            s.assets.GenerateImportBatchItemID(),
			ImportBatchID: session.ImportBatchID,
			Status:        itemStatus,
			MatchedShotID: matchedShotID,
			AssetID:       mediaAsset.ID,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := s.assets.SaveImportBatchItem(r.Context(), item); err != nil {
			return asset.UploadSession{}, err
		}
		if batch, ok := s.assets.GetImportBatch(session.ImportBatchID); ok {
			batch.Status = itemStatus
			batch.UpdatedAt = now
			if err := s.assets.SaveImportBatch(r.Context(), batch); err != nil {
				return asset.UploadSession{}, err
			}
		}
		if shotExecutionID != "" {
			s.publishShotExecutionUpdated(r.Context(), shotExecution, candidateAssetID, mediaAsset.ID)
		}
	}

	return session, nil
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

func (s *Service) writeSessionResponse(w http.ResponseWriter, statusCode int, session asset.UploadSession) {
	decision := s.evaluateUploadResumeAllowed(session)
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
	uploadFileID, assetID, variantID, candidateAssetID, shotExecutionID := s.findSessionArtifacts(session.ID)
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

func (s *Service) publishUploadSessionUpdated(ctx context.Context, session asset.UploadSession) {
	if s == nil || s.eventPublisher == nil {
		return
	}
	decision := s.evaluateUploadResumeAllowed(session)

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

	s.eventPublisher.PublishWithContext(ctx, events.Event{
		EventType:      "asset.upload_session.updated",
		OrganizationID: session.OrgID,
		ProjectID:      session.ProjectID,
		ResourceType:   "upload_session",
		ResourceID:     session.ID,
		Payload:        string(body),
	})
}

func (s *Service) publishShotExecutionUpdated(ctx context.Context, record execution.ShotExecution, candidateAssetID string, assetID string) {
	if s == nil || s.eventPublisher == nil {
		return
	}

	body, err := json.Marshal(map[string]any{
		"shot_execution_id":  record.ID,
		"shot_id":            record.ShotID,
		"status":             record.Status,
		"current_run_id":     record.CurrentRunID,
		"candidate_asset_id": strings.TrimSpace(candidateAssetID),
		"asset_id":           strings.TrimSpace(assetID),
	})
	if err != nil {
		return
	}

	s.eventPublisher.PublishWithContext(ctx, events.Event{
		EventType:      "shot.execution.updated",
		OrganizationID: record.OrgID,
		ProjectID:      record.ProjectID,
		ResourceType:   "shot_execution",
		ResourceID:     record.ID,
		Payload:        string(body),
	})
}

func (s *Service) publishImportBatchUpdated(ctx context.Context, importBatchID string, reason string, uploadSessionID string) {
	if s == nil || s.eventPublisher == nil {
		return
	}
	importBatchID = strings.TrimSpace(importBatchID)
	if importBatchID == "" {
		return
	}

	importBatch, ok := s.assets.GetImportBatch(importBatchID)
	if !ok {
		return
	}

	projectID := strings.TrimSpace(importBatch.ProjectID)
	if projectID == "" {
		return
	}

	body, err := json.Marshal(asset.ImportBatchUpdatedEventPayload{
		ImportBatchID:   importBatchID,
		Status:          strings.TrimSpace(importBatch.Status),
		Reason:          strings.TrimSpace(reason),
		UploadSessionID: strings.TrimSpace(uploadSessionID),
		OrganizationID:  strings.TrimSpace(importBatch.OrgID),
		ProjectID:       projectID,
	})
	if err != nil {
		return
	}

	s.eventPublisher.PublishWithContext(ctx, events.Event{
		EventType:      "asset.import_batch.updated",
		OrganizationID: strings.TrimSpace(importBatch.OrgID),
		ProjectID:      projectID,
		ResourceType:   "import_batch",
		ResourceID:     importBatchID,
		Payload:        string(body),
	})
}

func (s *Service) findSessionArtifacts(sessionID string) (string, string, string, string, string) {
	if s == nil || s.assets == nil {
		return "", "", "", "", ""
	}

	uploadFiles := s.assets.ListUploadFilesBySessionIDs([]string{sessionID})
	if len(uploadFiles) == 0 {
		return "", "", "", "", ""
	}

	uploadFileID := uploadFiles[0].ID
	variants := s.assets.ListMediaAssetVariantsByUploadFileIDs([]string{uploadFileID})
	if len(variants) == 0 {
		return uploadFileID, "", "", "", ""
	}

	variantID := variants[0].ID
	assetID := variants[0].AssetID
	candidates := s.assets.ListCandidateAssetsByAssetIDs([]string{assetID})
	if len(candidates) == 0 {
		return uploadFileID, assetID, variantID, "", ""
	}

	return uploadFileID, assetID, variantID, candidates[0].ID, candidates[0].ShotExecutionID
}

func (s *Service) evaluateUploadResumeAllowed(session asset.UploadSession) policyapp.UploadResumeDecision {
	if s != nil && s.policy != nil {
		return s.policy.EvaluateUploadResumeAllowed(session)
	}
	return policyapp.UploadResumeDecision{
		CanRetry:    true,
		CanComplete: strings.TrimSpace(session.Status) != "uploaded",
		ResumeHint:  fmt.Sprintf("upload %s from byte 0", session.FileName),
	}
}

func writeUploadError(w http.ResponseWriter, err error) {
	if err == nil {
		w.WriteHeader(http.StatusInternalServerError)
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
	if strings.Contains(err.Error(), "not found") {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Error(w, err.Error(), http.StatusBadRequest)
}
