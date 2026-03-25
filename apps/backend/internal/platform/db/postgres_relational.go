package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/lib/pq"
)

type evaluationSummaryPayload struct {
	PassedChecks []string `json:"passed_checks"`
	FailedChecks []string `json:"failed_checks"`
}

func newEmptySnapshot() Snapshot {
	return NewMemoryStore().snapshot()
}

func extractFallbackSnapshot(snapshot Snapshot) Snapshot {
	fallback := newEmptySnapshot()
	fallback.NextWorkflowRunID = snapshot.NextWorkflowRunID
	fallback.NextWorkflowStepID = snapshot.NextWorkflowStepID
	fallback.NextJobID = snapshot.NextJobID
	fallback.NextStateTransitionID = snapshot.NextStateTransitionID
	fallback.NextGatewayRequestID = snapshot.NextGatewayRequestID
	fallback.WorkflowRuns = cloneMap(snapshot.WorkflowRuns)
	fallback.WorkflowSteps = cloneMap(snapshot.WorkflowSteps)
	fallback.Jobs = cloneMap(snapshot.Jobs)
	fallback.StateTransitions = cloneMap(snapshot.StateTransitions)
	fallback.GatewayResults = cloneMap(snapshot.GatewayResults)
	return fallback
}

func mergeFallbackSnapshot(target *Snapshot, fallback Snapshot) {
	target.NextWorkflowRunID = fallback.NextWorkflowRunID
	target.NextWorkflowStepID = fallback.NextWorkflowStepID
	target.NextJobID = fallback.NextJobID
	target.NextStateTransitionID = fallback.NextStateTransitionID
	target.NextGatewayRequestID = fallback.NextGatewayRequestID
	target.WorkflowRuns = cloneMap(fallback.WorkflowRuns)
	target.WorkflowSteps = cloneMap(fallback.WorkflowSteps)
	target.Jobs = cloneMap(fallback.Jobs)
	target.StateTransitions = cloneMap(fallback.StateTransitions)
	target.GatewayResults = cloneMap(fallback.GatewayResults)
}

func nullableUUID(raw string) any {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	if _, err := uuid.Parse(value); err != nil {
		return nil
	}
	return value
}

func nullableTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}

func normalizeSnapshotGroupID(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return uuid.NewString()
	}
	if _, err := uuid.Parse(value); err != nil {
		return uuid.NewString()
	}
	return value
}

func normalizeUploadSessionStatusForDB(sessionStatus string, expiresAt time.Time) string {
	switch strings.TrimSpace(sessionStatus) {
	case "uploaded":
		return "completed"
	case "expired":
		return "expired"
	case "active":
		return "active"
	case "cancelled":
		return "cancelled"
	}
	if !expiresAt.IsZero() && !expiresAt.After(time.Now().UTC()) {
		return "expired"
	}
	return "pending"
}

func normalizeUploadSessionStatusFromDB(sessionStatus string) string {
	switch strings.TrimSpace(sessionStatus) {
	case "completed":
		return "uploaded"
	case "expired":
		return "expired"
	case "cancelled":
		return "cancelled"
	default:
		return "pending"
	}
}

func jsonString(value any) (string, error) {
	body, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func stringFromPayload(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}

func int64FromPayload(payload map[string]any, key string) int64 {
	value, ok := payload[key]
	if !ok {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int64:
		return typed
	case int:
		return int64(typed)
	case json.Number:
		result, _ := typed.Int64()
		return result
	default:
		return 0
	}
}

func emptyToNil(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return strings.TrimSpace(value)
}

func defaultString(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func normalizeAssetMediaType(value string) string {
	switch strings.TrimSpace(value) {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio":
		return "audio"
	case "document":
		return "document"
	case "other":
		return "other"
	default:
		return "image"
	}
}

func nullableInt(value int) any {
	if value <= 0 {
		return nil
	}
	return value
}

func nullableInt64(value int64) any {
	if value <= 0 {
		return nil
	}
	return value
}

func ifStatusUploaded(status string, fallback time.Time) time.Time {
	if strings.TrimSpace(status) == "uploaded" {
		return fallback
	}
	return time.Time{}
}

func reviewedAtForItem(record asset.ImportBatchItem) time.Time {
	switch strings.TrimSpace(record.Status) {
	case "confirmed", "matched_pending_confirm":
		return record.UpdatedAt
	default:
		return time.Time{}
	}
}

func (p *PostgresPersister) loadRelationalSnapshot(ctx context.Context, snapshot *Snapshot) error {
	if err := p.loadAuthOrg(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadProjectsEpisodesScenesShotsSnapshots(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadCollaborationAndPreview(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadPreviewRuntimes(ctx, snapshot); err != nil {
		return err
	}
	runExecutionMap, err := p.loadExecutions(ctx, snapshot)
	if err != nil {
		return err
	}
	if err := p.loadAssets(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadAudioTimelines(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadAudioRuntimes(ctx, snapshot); err != nil {
		return err
	}
	if err := p.loadBillingAndReview(ctx, snapshot, runExecutionMap); err != nil {
		return err
	}
	return nil
}

func (p *PostgresPersister) loadAuthOrg(ctx context.Context, snapshot *Snapshot) error {
	organizationRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, slug, display_name, default_ui_locale, default_content_locale
		FROM organizations
	`)
	if err != nil {
		return fmt.Errorf("db: load organizations: %w", err)
	}
	defer organizationRows.Close()
	for organizationRows.Next() {
		var record org.Organization
		if err := organizationRows.Scan(&record.ID, &record.Slug, &record.DisplayName, &record.DefaultUILocale, &record.DefaultContentLocale); err != nil {
			return fmt.Errorf("db: scan organization: %w", err)
		}
		snapshot.Organizations[record.ID] = record
	}
	if err := organizationRows.Err(); err != nil {
		return fmt.Errorf("db: iterate organizations: %w", err)
	}

	userRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, email, display_name, preferred_ui_locale, COALESCE(timezone, '')
		FROM users
	`)
	if err != nil {
		return fmt.Errorf("db: load users: %w", err)
	}
	defer userRows.Close()
	for userRows.Next() {
		var record auth.User
		if err := userRows.Scan(&record.ID, &record.Email, &record.DisplayName, &record.PreferredUILocale, &record.Timezone); err != nil {
			return fmt.Errorf("db: scan user: %w", err)
		}
		snapshot.Users[record.ID] = record
	}
	if err := userRows.Err(); err != nil {
		return fmt.Errorf("db: iterate users: %w", err)
	}

	roleRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, role_code, display_name
		FROM roles
	`)
	if err != nil {
		return fmt.Errorf("db: load roles: %w", err)
	}
	defer roleRows.Close()
	for roleRows.Next() {
		var record org.Role
		if err := roleRows.Scan(&record.ID, &record.OrgID, &record.Code, &record.DisplayName); err != nil {
			return fmt.Errorf("db: scan role: %w", err)
		}
		snapshot.Roles[record.ID] = record
	}
	if err := roleRows.Err(); err != nil {
		return fmt.Errorf("db: iterate roles: %w", err)
	}

	memberRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, user_id::text, COALESCE(role_id::text, ''), membership_status
		FROM memberships
	`)
	if err != nil {
		return fmt.Errorf("db: load memberships: %w", err)
	}
	defer memberRows.Close()
	for memberRows.Next() {
		var record org.Member
		if err := memberRows.Scan(&record.ID, &record.OrgID, &record.UserID, &record.RoleID, &record.Status); err != nil {
			return fmt.Errorf("db: scan membership: %w", err)
		}
		snapshot.Memberships[record.ID] = record
	}
	if err := memberRows.Err(); err != nil {
		return fmt.Errorf("db: iterate memberships: %w", err)
	}

	permissionRows, err := p.db.QueryContext(ctx, `
		SELECT role_id::text, permission_code
		FROM role_permissions
		ORDER BY role_id, permission_code
	`)
	if err != nil {
		return fmt.Errorf("db: load role permissions: %w", err)
	}
	defer permissionRows.Close()
	for permissionRows.Next() {
		var roleID string
		var permissionCode string
		if err := permissionRows.Scan(&roleID, &permissionCode); err != nil {
			return fmt.Errorf("db: scan role permission: %w", err)
		}
		snapshot.RolePermissions[roleID] = append(snapshot.RolePermissions[roleID], permissionCode)
	}
	if err := permissionRows.Err(); err != nil {
		return fmt.Errorf("db: iterate role permissions: %w", err)
	}

	return nil
}

func (p *PostgresPersister) loadProjectsEpisodesScenesShotsSnapshots(ctx context.Context, snapshot *Snapshot) error {
	projectRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, owner_user_id::text, title, status, current_stage,
		       primary_content_locale, supported_content_locales, created_at, updated_at
		FROM projects
	`)
	if err != nil {
		return fmt.Errorf("db: load projects: %w", err)
	}
	defer projectRows.Close()
	for projectRows.Next() {
		var (
			id, organizationID, ownerUserID, title, status, currentStage, primaryLocale string
			supportedLocales                                                            pq.StringArray
			createdAt, updatedAt                                                        time.Time
		)
		if err := projectRows.Scan(&id, &organizationID, &ownerUserID, &title, &status, &currentStage, &primaryLocale, &supportedLocales, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan project: %w", err)
		}
		snapshot.Projects[id] = project.Project{
			ID:                      id,
			OrganizationID:          organizationID,
			OwnerUserID:             ownerUserID,
			Title:                   title,
			Status:                  status,
			CurrentStage:            currentStage,
			PrimaryContentLocale:    primaryLocale,
			SupportedContentLocales: append([]string(nil), supportedLocales...),
			CreatedAt:               createdAt.UTC(),
			UpdatedAt:               updatedAt.UTC(),
		}
	}
	if err := projectRows.Err(); err != nil {
		return fmt.Errorf("db: iterate projects: %w", err)
	}

	episodeRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, project_id::text, episode_no, title, created_at, updated_at
		FROM episodes
	`)
	if err != nil {
		return fmt.Errorf("db: load episodes: %w", err)
	}
	defer episodeRows.Close()
	for episodeRows.Next() {
		var (
			id, projectID, title string
			episodeNo            int
			createdAt, updatedAt time.Time
		)
		if err := episodeRows.Scan(&id, &projectID, &episodeNo, &title, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan episode: %w", err)
		}
		snapshot.Episodes[id] = project.Episode{
			ID:        id,
			ProjectID: projectID,
			EpisodeNo: episodeNo,
			Title:     title,
			CreatedAt: createdAt.UTC(),
			UpdatedAt: updatedAt.UTC(),
		}
	}
	if err := episodeRows.Err(); err != nil {
		return fmt.Errorf("db: iterate episodes: %w", err)
	}

	sceneRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, project_id::text, episode_id::text, scene_no, title, COALESCE(source_locale, ''), created_at, updated_at
		FROM scenes
	`)
	if err != nil {
		return fmt.Errorf("db: load scenes: %w", err)
	}
	defer sceneRows.Close()
	for sceneRows.Next() {
		var (
			id, projectID, episodeID, title, sourceLocale string
			sceneNo                                       int
			createdAt, updatedAt                          time.Time
		)
		if err := sceneRows.Scan(&id, &projectID, &episodeID, &sceneNo, &title, &sourceLocale, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan scene: %w", err)
		}
		snapshot.Scenes[id] = content.Scene{
			ID:           id,
			ProjectID:    projectID,
			EpisodeID:    episodeID,
			SceneNo:      sceneNo,
			Code:         fmt.Sprintf("SCENE-%03d", sceneNo),
			Title:        title,
			SourceLocale: sourceLocale,
			CreatedAt:    createdAt.UTC(),
			UpdatedAt:    updatedAt.UTC(),
		}
	}
	if err := sceneRows.Err(); err != nil {
		return fmt.Errorf("db: iterate scenes: %w", err)
	}

	shotRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, scene_id::text, shot_no, COALESCE(code, ''), COALESCE(title, ''), COALESCE(source_locale, ''), created_at, updated_at
		FROM shots
	`)
	if err != nil {
		return fmt.Errorf("db: load shots: %w", err)
	}
	defer shotRows.Close()
	for shotRows.Next() {
		var (
			id, sceneID, code, title, sourceLocale string
			shotNo                                 int
			createdAt, updatedAt                   time.Time
		)
		if err := shotRows.Scan(&id, &sceneID, &shotNo, &code, &title, &sourceLocale, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan shot: %w", err)
		}
		if code == "" {
			sceneCode := fmt.Sprintf("SCENE-%03d", shotNo)
			if scene, ok := snapshot.Scenes[sceneID]; ok && scene.Code != "" {
				sceneCode = scene.Code
			}
			code = fmt.Sprintf("%s-SHOT-%03d", sceneCode, shotNo)
		}
		snapshot.Shots[id] = content.Shot{
			ID:           id,
			SceneID:      sceneID,
			ShotNo:       shotNo,
			Code:         code,
			Title:        title,
			SourceLocale: sourceLocale,
			CreatedAt:    createdAt.UTC(),
			UpdatedAt:    updatedAt.UTC(),
		}
	}
	if err := shotRows.Err(); err != nil {
		return fmt.Errorf("db: iterate shots: %w", err)
	}

	snapshotRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, resource_type, resource_id::text, snapshot_kind, locale,
		       COALESCE(source_snapshot_id::text, ''), translation_group_id::text,
		       translation_status, body, created_at, updated_at
		FROM content_snapshots
	`)
	if err != nil {
		return fmt.Errorf("db: load content snapshots: %w", err)
	}
	defer snapshotRows.Close()
	for snapshotRows.Next() {
		var (
			id, ownerType, ownerID, snapshotKind, locale, sourceSnapshotID, translationGroupID, translationStatus, body string
			createdAt, updatedAt                                                                          time.Time
		)
		if err := snapshotRows.Scan(&id, &ownerType, &ownerID, &snapshotKind, &locale, &sourceSnapshotID, &translationGroupID, &translationStatus, &body, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan content snapshot: %w", err)
		}
		snapshot.Snapshots[id] = content.Snapshot{
			ID:                 id,
			OwnerType:          ownerType,
			OwnerID:            ownerID,
			SnapshotKind:       snapshotKind,
			Locale:             locale,
			SourceSnapshotID:   sourceSnapshotID,
			TranslationGroupID: translationGroupID,
			TranslationStatus:  translationStatus,
			Body:               body,
			CreatedAt:          createdAt.UTC(),
			UpdatedAt:          updatedAt.UTC(),
		}
	}
	if err := snapshotRows.Err(); err != nil {
		return fmt.Errorf("db: iterate content snapshots: %w", err)
	}

	return nil
}

func (p *PostgresPersister) loadExecutions(ctx context.Context, snapshot *Snapshot) (map[string]string, error) {
	executionRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, shot_id::text, status,
		       COALESCE(primary_asset_id::text, ''), COALESCE(current_run_id::text, ''), created_at, updated_at
		FROM shot_executions
	`)
	if err != nil {
		return nil, fmt.Errorf("db: load shot executions: %w", err)
	}
	defer executionRows.Close()
	for executionRows.Next() {
		var (
			id, organizationID, projectID, shotID, status, primaryAssetID, currentRunID string
			createdAt, updatedAt                                                        time.Time
		)
		if err := executionRows.Scan(&id, &organizationID, &projectID, &shotID, &status, &primaryAssetID, &currentRunID, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("db: scan shot execution: %w", err)
		}
		snapshot.ShotExecutions[id] = execution.ShotExecution{
			ID:             id,
			OrgID:          organizationID,
			ProjectID:      projectID,
			ShotID:         shotID,
			Status:         status,
			PrimaryAssetID: primaryAssetID,
			CurrentRunID:   currentRunID,
			CreatedAt:      createdAt.UTC(),
			UpdatedAt:      updatedAt.UTC(),
		}
	}
	if err := executionRows.Err(); err != nil {
		return nil, fmt.Errorf("db: iterate shot executions: %w", err)
	}

	runExecutionMap := make(map[string]string)
	runRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, shot_execution_id::text, run_number, status, trigger_source,
		       COALESCE(created_by_user_id::text, ''), created_at, updated_at
		FROM shot_execution_runs
	`)
	if err != nil {
		return nil, fmt.Errorf("db: load shot execution runs: %w", err)
	}
	defer runRows.Close()
	for runRows.Next() {
		var (
			id, shotExecutionID, status, triggerSource, operatorID string
			runNumber                                              int
			createdAt, updatedAt                                   time.Time
		)
		if err := runRows.Scan(&id, &shotExecutionID, &runNumber, &status, &triggerSource, &operatorID, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("db: scan shot execution run: %w", err)
		}
		snapshot.ShotExecutionRuns[id] = execution.ShotExecutionRun{
			ID:              id,
			ShotExecutionID: shotExecutionID,
			RunNumber:       runNumber,
			Status:          status,
			TriggerType:     triggerSource,
			OperatorID:      operatorID,
			CreatedAt:       createdAt.UTC(),
			UpdatedAt:       updatedAt.UTC(),
		}
		runExecutionMap[id] = shotExecutionID
	}
	if err := runRows.Err(); err != nil {
		return nil, fmt.Errorf("db: iterate shot execution runs: %w", err)
	}

	return runExecutionMap, nil
}

func (p *PostgresPersister) loadAssets(ctx context.Context, snapshot *Snapshot) error {
	batchRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(created_by_user_id::text, ''),
		       source_type, status, created_at, updated_at
		FROM import_batches
	`)
	if err != nil {
		return fmt.Errorf("db: load import batches: %w", err)
	}
	defer batchRows.Close()
	for batchRows.Next() {
		var (
			id, organizationID, projectID, operatorID, sourceType, status string
			createdAt, updatedAt                                          time.Time
		)
		if err := batchRows.Scan(&id, &organizationID, &projectID, &operatorID, &sourceType, &status, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan import batch: %w", err)
		}
		snapshot.ImportBatches[id] = asset.ImportBatch{
			ID:         id,
			OrgID:      organizationID,
			ProjectID:  projectID,
			OperatorID: operatorID,
			SourceType: sourceType,
			Status:     status,
			CreatedAt:  createdAt.UTC(),
			UpdatedAt:  updatedAt.UTC(),
		}
	}
	if err := batchRows.Err(); err != nil {
		return fmt.Errorf("db: iterate import batches: %w", err)
	}

	sessionRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, COALESCE(project_id::text, ''), COALESCE(import_batch_id::text, ''),
		       COALESCE(file_name, ''), COALESCE(checksum_sha256, ''), COALESCE(size_bytes, 0), COALESCE(retry_count, 0),
		       status, COALESCE(resume_hint, ''), created_at, expires_at, COALESCE(last_retry_at, created_at)
		FROM upload_sessions
	`)
	if err != nil {
		return fmt.Errorf("db: load upload sessions: %w", err)
	}
	defer sessionRows.Close()
	for sessionRows.Next() {
		var (
			id, organizationID, projectID, importBatchID, fileName, checksum, status, resumeHint string
			sizeBytes                                                                            int64
			retryCount                                                                           int
			createdAt, expiresAt, lastRetryAt                                                    time.Time
		)
		if err := sessionRows.Scan(&id, &organizationID, &projectID, &importBatchID, &fileName, &checksum, &sizeBytes, &retryCount, &status, &resumeHint, &createdAt, &expiresAt, &lastRetryAt); err != nil {
			return fmt.Errorf("db: scan upload session: %w", err)
		}
		snapshot.UploadSessions[id] = asset.UploadSession{
			ID:            id,
			OrgID:         organizationID,
			ProjectID:     projectID,
			ImportBatchID: importBatchID,
			FileName:      fileName,
			Checksum:      checksum,
			SizeBytes:     sizeBytes,
			RetryCount:    retryCount,
			Status:        normalizeUploadSessionStatusFromDB(status),
			ResumeHint:    resumeHint,
			CreatedAt:     createdAt.UTC(),
			ExpiresAt:     expiresAt.UTC(),
			LastRetryAt:   lastRetryAt.UTC(),
		}
	}
	if err := sessionRows.Err(); err != nil {
		return fmt.Errorf("db: iterate upload sessions: %w", err)
	}

	fileRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, upload_session_id::text, original_file_name, COALESCE(mime_type, ''),
		       COALESCE(checksum_sha256, ''), COALESCE(file_size_bytes, 0), created_at
		FROM upload_files
	`)
	if err != nil {
		return fmt.Errorf("db: load upload files: %w", err)
	}
	defer fileRows.Close()
	for fileRows.Next() {
		var (
			id, uploadSessionID, fileName, mimeType, checksum string
			sizeBytes                                         int64
			createdAt                                         time.Time
		)
		if err := fileRows.Scan(&id, &uploadSessionID, &fileName, &mimeType, &checksum, &sizeBytes, &createdAt); err != nil {
			return fmt.Errorf("db: scan upload file: %w", err)
		}
		snapshot.UploadFiles[id] = asset.UploadFile{
			ID:              id,
			UploadSessionID: uploadSessionID,
			FileName:        fileName,
			MimeType:        mimeType,
			Checksum:        checksum,
			SizeBytes:       sizeBytes,
			CreatedAt:       createdAt.UTC(),
		}
	}
	if err := fileRows.Err(); err != nil {
		return fmt.Errorf("db: iterate upload files: %w", err)
	}

	assetUploadFiles := make(map[string]string)
	assetRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(import_batch_id::text, ''),
		       asset_type, source_type, COALESCE(locale, ''), rights_status, ai_annotated, created_at, updated_at,
		       COALESCE(upload_file_id::text, '')
		FROM media_assets
	`)
	if err != nil {
		return fmt.Errorf("db: load media assets: %w", err)
	}
	defer assetRows.Close()
	for assetRows.Next() {
		var (
			id, organizationID, projectID, importBatchID, mediaType, sourceType, locale, rightsStatus, uploadFileID string
			aiAnnotated                                                                                             bool
			createdAt, updatedAt                                                                                    time.Time
		)
		if err := assetRows.Scan(&id, &organizationID, &projectID, &importBatchID, &mediaType, &sourceType, &locale, &rightsStatus, &aiAnnotated, &createdAt, &updatedAt, &uploadFileID); err != nil {
			return fmt.Errorf("db: scan media asset: %w", err)
		}
		snapshot.MediaAssets[id] = asset.MediaAsset{
			ID:            id,
			OrgID:         organizationID,
			ProjectID:     projectID,
			ImportBatchID: importBatchID,
			MediaType:     mediaType,
			SourceType:    sourceType,
			Locale:        locale,
			RightsStatus:  rightsStatus,
			AIAnnotated:   aiAnnotated,
			CreatedAt:     createdAt.UTC(),
			UpdatedAt:     updatedAt.UTC(),
		}
		assetUploadFiles[id] = uploadFileID
	}
	if err := assetRows.Err(); err != nil {
		return fmt.Errorf("db: iterate media assets: %w", err)
	}

	variantRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, media_asset_id::text, variant_type, COALESCE(mime_type, ''),
		       COALESCE(width, 0), COALESCE(height, 0), COALESCE(duration_ms, 0), created_at
		FROM media_asset_variants
	`)
	if err != nil {
		return fmt.Errorf("db: load media asset variants: %w", err)
	}
	defer variantRows.Close()
	for variantRows.Next() {
		var (
			id, assetID, variantType, mimeType string
			width, height, durationMS          int
			createdAt                          time.Time
		)
		if err := variantRows.Scan(&id, &assetID, &variantType, &mimeType, &width, &height, &durationMS, &createdAt); err != nil {
			return fmt.Errorf("db: scan media asset variant: %w", err)
		}
		snapshot.MediaAssetVariants[id] = asset.MediaAssetVariant{
			ID:           id,
			AssetID:      assetID,
			UploadFileID: assetUploadFiles[assetID],
			VariantType:  variantType,
			MimeType:     mimeType,
			Width:        width,
			Height:       height,
			DurationMS:   durationMS,
			CreatedAt:    createdAt.UTC(),
		}
	}
	if err := variantRows.Err(); err != nil {
		return fmt.Errorf("db: iterate media asset variants: %w", err)
	}

	itemRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, import_batch_id::text, status, COALESCE(matched_shot_id::text, ''),
		       COALESCE(media_asset_id::text, ''), created_at, updated_at
		FROM import_batch_items
	`)
	if err != nil {
		return fmt.Errorf("db: load import batch items: %w", err)
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var (
			id, importBatchID, status, matchedShotID, mediaAssetID string
			createdAt, updatedAt                                   time.Time
		)
		if err := itemRows.Scan(&id, &importBatchID, &status, &matchedShotID, &mediaAssetID, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan import batch item: %w", err)
		}
		snapshot.ImportBatchItems[id] = asset.ImportBatchItem{
			ID:            id,
			ImportBatchID: importBatchID,
			Status:        status,
			MatchedShotID: matchedShotID,
			AssetID:       mediaAssetID,
			CreatedAt:     createdAt.UTC(),
			UpdatedAt:     updatedAt.UTC(),
		}
	}
	if err := itemRows.Err(); err != nil {
		return fmt.Errorf("db: iterate import batch items: %w", err)
	}

	candidateRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, shot_execution_id::text, media_asset_id::text, COALESCE(source_run_id::text, ''),
		       created_at, updated_at
		FROM shot_candidate_assets
	`)
	if err != nil {
		return fmt.Errorf("db: load shot candidate assets: %w", err)
	}
	defer candidateRows.Close()
	for candidateRows.Next() {
		var (
			id, shotExecutionID, assetID, sourceRunID string
			createdAt, updatedAt                      time.Time
		)
		if err := candidateRows.Scan(&id, &shotExecutionID, &assetID, &sourceRunID, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan shot candidate asset: %w", err)
		}
		snapshot.CandidateAssets[id] = asset.CandidateAsset{
			ID:              id,
			ShotExecutionID: shotExecutionID,
			AssetID:         assetID,
			SourceRunID:     sourceRunID,
			CreatedAt:       createdAt.UTC(),
			UpdatedAt:       updatedAt.UTC(),
		}
	}
	if err := candidateRows.Err(); err != nil {
		return fmt.Errorf("db: iterate shot candidate assets: %w", err)
	}

	return nil
}

func (p *PostgresPersister) loadBillingAndReview(ctx context.Context, snapshot *Snapshot, runExecutionMap map[string]string) error {
	budgetRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, max_budget_units, created_at, updated_at
		FROM budget_policies
		WHERE archived_at IS NULL
	`)
	if err != nil {
		return fmt.Errorf("db: load budget policies: %w", err)
	}
	defer budgetRows.Close()
	projectBudgetByProject := make(map[string]string)
	for budgetRows.Next() {
		var (
			id, organizationID, projectID string
			limitCents                    int64
			createdAt, updatedAt          time.Time
		)
		if err := budgetRows.Scan(&id, &organizationID, &projectID, &limitCents, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan budget policy: %w", err)
		}
		snapshot.Budgets[id] = billing.ProjectBudget{
			ID:         id,
			OrgID:      organizationID,
			ProjectID:  projectID,
			LimitCents: limitCents,
			CreatedAt:  createdAt.UTC(),
			UpdatedAt:  updatedAt.UTC(),
		}
		projectBudgetByProject[projectID] = id
	}
	if err := budgetRows.Err(); err != nil {
		return fmt.Errorf("db: iterate budget policies: %w", err)
	}

	usageRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(shot_execution_run_id::text, ''),
		       usage_type, total_cost_units, created_at
		FROM usage_records
	`)
	if err != nil {
		return fmt.Errorf("db: load usage records: %w", err)
	}
	defer usageRows.Close()
	for usageRows.Next() {
		var (
			id, organizationID, projectID, shotExecutionRunID, usageType string
			totalCostUnits                                               int64
			createdAt                                                    time.Time
		)
		if err := usageRows.Scan(&id, &organizationID, &projectID, &shotExecutionRunID, &usageType, &totalCostUnits, &createdAt); err != nil {
			return fmt.Errorf("db: scan usage record: %w", err)
		}
		snapshot.UsageRecords[id] = billing.UsageRecord{
			ID:                 id,
			OrgID:              organizationID,
			ProjectID:          projectID,
			ShotExecutionID:    runExecutionMap[shotExecutionRunID],
			ShotExecutionRunID: shotExecutionRunID,
			Meter:              usageType,
			AmountCents:        totalCostUnits,
			CreatedAt:          createdAt.UTC(),
		}
		if budgetID, ok := projectBudgetByProject[projectID]; ok {
			budgetRecord := snapshot.Budgets[budgetID]
			budgetRecord.ReservedCents += totalCostUnits
			snapshot.Budgets[budgetID] = budgetRecord
		}
	}
	if err := usageRows.Err(); err != nil {
		return fmt.Errorf("db: iterate usage records: %w", err)
	}

	billingRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, event_type, payload::text, created_at
		FROM billing_events
	`)
	if err != nil {
		return fmt.Errorf("db: load billing events: %w", err)
	}
	defer billingRows.Close()
	for billingRows.Next() {
		var (
			id, organizationID, projectID, eventType, payloadText string
			createdAt                                             time.Time
		)
		if err := billingRows.Scan(&id, &organizationID, &projectID, &eventType, &payloadText, &createdAt); err != nil {
			return fmt.Errorf("db: scan billing event: %w", err)
		}
		payload := map[string]any{}
		if payloadText != "" {
			_ = json.Unmarshal([]byte(payloadText), &payload)
		}
		snapshot.BillingEvents[id] = billing.BillingEvent{
			ID:                 id,
			OrgID:              organizationID,
			ProjectID:          projectID,
			ShotExecutionID:    stringFromPayload(payload, "shot_execution_id"),
			ShotExecutionRunID: stringFromPayload(payload, "shot_execution_run_id"),
			EventType:          eventType,
			AmountCents:        int64FromPayload(payload, "amount_cents"),
			CreatedAt:          createdAt.UTC(),
		}
	}
	if err := billingRows.Err(); err != nil {
		return fmt.Errorf("db: iterate billing events: %w", err)
	}

	evaluationRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, shot_execution_id::text, status, result_summary::text, created_at, updated_at
		FROM evaluation_runs
	`)
	if err != nil {
		return fmt.Errorf("db: load evaluation runs: %w", err)
	}
	defer evaluationRows.Close()
	for evaluationRows.Next() {
		var (
			id, shotExecutionID, status, summaryText string
			createdAt, updatedAt                     time.Time
		)
		if err := evaluationRows.Scan(&id, &shotExecutionID, &status, &summaryText, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan evaluation run: %w", err)
		}
		var payload evaluationSummaryPayload
		if summaryText != "" {
			_ = json.Unmarshal([]byte(summaryText), &payload)
		}
		snapshot.EvaluationRuns[id] = review.EvaluationRun{
			ID:              id,
			ShotExecutionID: shotExecutionID,
			PassedChecks:    append([]string(nil), payload.PassedChecks...),
			FailedChecks:    append([]string(nil), payload.FailedChecks...),
			Status:          status,
			CreatedAt:       createdAt.UTC(),
			UpdatedAt:       updatedAt.UTC(),
		}
	}
	if err := evaluationRows.Err(); err != nil {
		return fmt.Errorf("db: iterate evaluation runs: %w", err)
	}

	reviewRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, shot_execution_id::text, conclusion, comment_locale, COALESCE(comment_body, ''), created_at, updated_at
		FROM shot_reviews
	`)
	if err != nil {
		return fmt.Errorf("db: load shot reviews: %w", err)
	}
	defer reviewRows.Close()
	for reviewRows.Next() {
		var (
			id, shotExecutionID, conclusion, commentLocale, commentBody string
			createdAt, updatedAt                                        time.Time
		)
		if err := reviewRows.Scan(&id, &shotExecutionID, &conclusion, &commentLocale, &commentBody, &createdAt, &updatedAt); err != nil {
			return fmt.Errorf("db: scan shot review: %w", err)
		}
		snapshot.Reviews[id] = review.ShotReview{
			ID:              id,
			ShotExecutionID: shotExecutionID,
			Conclusion:      conclusion,
			CommentLocale:   commentLocale,
			Comment:         commentBody,
			CreatedAt:       createdAt.UTC(),
			UpdatedAt:       updatedAt.UTC(),
		}
	}
	if err := reviewRows.Err(); err != nil {
		return fmt.Errorf("db: iterate shot reviews: %w", err)
	}

	return nil
}

func (p *PostgresPersister) saveRelationalSnapshot(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	if err := clearMainTables(ctx, tx); err != nil {
		return err
	}
	if err := p.saveAuthOrg(ctx, tx, snapshot); err != nil {
		return err
	}
	if err := p.saveProjectsEpisodesScenesShotsSnapshots(ctx, tx, snapshot); err != nil {
		return err
	}
	if err := p.saveCollaborationAndPreview(ctx, tx, snapshot); err != nil {
		return err
	}
	if err := p.savePreviewRuntimes(ctx, tx, snapshot); err != nil {
		return err
	}
	usageIDsByRun, budgetIDsByProject, err := p.saveExecutionsAssetsReviewBilling(ctx, tx, snapshot)
	if err != nil {
		return err
	}
	if err := p.saveAudioTimelines(ctx, tx, snapshot); err != nil {
		return err
	}
	if err := p.saveAudioRuntimes(ctx, tx, snapshot); err != nil {
		return err
	}
	if err := p.saveBillingEvents(ctx, tx, snapshot, usageIDsByRun, budgetIDsByProject); err != nil {
		return err
	}
	return nil
}

func (p *PostgresPersister) saveAuthOrg(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.Organizations {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO organizations (
				id, slug, display_name, default_ui_locale, default_content_locale, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE
			SET slug = EXCLUDED.slug,
			    display_name = EXCLUDED.display_name,
			    default_ui_locale = EXCLUDED.default_ui_locale,
			    default_content_locale = EXCLUDED.default_content_locale,
			    updated_at = NOW()
		`, record.ID, record.Slug, record.DisplayName, record.DefaultUILocale, record.DefaultContentLocale); err != nil {
			return fmt.Errorf("db: upsert organization %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Users {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO users (
				id, email, display_name, preferred_ui_locale, timezone, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE
			SET email = EXCLUDED.email,
			    display_name = EXCLUDED.display_name,
			    preferred_ui_locale = EXCLUDED.preferred_ui_locale,
			    timezone = EXCLUDED.timezone,
			    updated_at = NOW()
		`, record.ID, record.Email, record.DisplayName, record.PreferredUILocale, emptyToNil(record.Timezone)); err != nil {
			return fmt.Errorf("db: upsert user %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Roles {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO roles (
				id, organization_id, role_code, display_name, created_at, updated_at
			) VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE
			SET organization_id = EXCLUDED.organization_id,
			    role_code = EXCLUDED.role_code,
			    display_name = EXCLUDED.display_name,
			    updated_at = NOW()
		`, record.ID, record.OrgID, record.Code, record.DisplayName); err != nil {
			return fmt.Errorf("db: upsert role %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Memberships {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO memberships (
				id, organization_id, user_id, role_id, membership_status, joined_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
			ON CONFLICT (id) DO UPDATE
			SET organization_id = EXCLUDED.organization_id,
			    user_id = EXCLUDED.user_id,
			    role_id = EXCLUDED.role_id,
			    membership_status = EXCLUDED.membership_status,
			    updated_at = NOW()
		`, record.ID, record.OrgID, record.UserID, nullableUUID(record.RoleID), defaultString(record.Status, "active")); err != nil {
			return fmt.Errorf("db: upsert membership %s: %w", record.ID, err)
		}
	}

	for roleID, permissionCodes := range snapshot.RolePermissions {
		if _, err := tx.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, roleID); err != nil {
			return fmt.Errorf("db: clear role permissions %s: %w", roleID, err)
		}
		for _, permissionCode := range permissionCodes {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO role_permissions (role_id, permission_code, created_at)
				VALUES ($1, $2, NOW())
			`, roleID, permissionCode); err != nil {
				return fmt.Errorf("db: insert role permission %s/%s: %w", roleID, permissionCode, err)
			}
		}
	}

	return nil
}

func clearMainTables(ctx context.Context, tx *sql.Tx) error {
	statements := []string{
		`DELETE FROM billing_events`,
		`DELETE FROM usage_records`,
		`DELETE FROM audio_runtimes`,
		`DELETE FROM audio_clips`,
		`DELETE FROM audio_tracks`,
		`DELETE FROM audio_timelines`,
		`DELETE FROM preview_runtimes`,
		`DELETE FROM preview_assembly_items`,
		`DELETE FROM preview_assemblies`,
		`DELETE FROM event_outbox`,
		`DELETE FROM state_transitions`,
		`DELETE FROM workflow_steps`,
		`DELETE FROM workflow_runs`,
		`DELETE FROM jobs`,
		`DELETE FROM shot_reviews`,
		`DELETE FROM evaluation_runs`,
		`DELETE FROM shot_candidate_assets`,
		`DELETE FROM import_batch_items`,
		`DELETE FROM media_asset_variants`,
		`DELETE FROM media_assets`,
		`DELETE FROM upload_files`,
		`DELETE FROM upload_sessions`,
		`DELETE FROM import_batches`,
		`DELETE FROM shot_execution_runs`,
		`DELETE FROM shot_executions`,
		`DELETE FROM collaboration_presences`,
		`DELETE FROM collaboration_sessions`,
		`DELETE FROM content_snapshots`,
		`DELETE FROM shots`,
		`DELETE FROM scenes`,
		`DELETE FROM episodes`,
		`DELETE FROM projects`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("db: clear relational tables: %w", err)
		}
	}
	return nil
}

func (p *PostgresPersister) saveProjectsEpisodesScenesShotsSnapshots(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	for _, record := range snapshot.Projects {
		supportedLocales := append([]string(nil), record.SupportedContentLocales...)
		if len(supportedLocales) == 0 {
			locale := strings.TrimSpace(record.PrimaryContentLocale)
			if locale == "" {
				locale = "zh-CN"
			}
			supportedLocales = []string{locale}
		}
		status := defaultString(record.Status, "draft")
		currentStage := defaultString(record.CurrentStage, "planning")
		primaryLocale := strings.TrimSpace(record.PrimaryContentLocale)
		if primaryLocale == "" {
			primaryLocale = supportedLocales[0]
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO projects (
				id, organization_id, owner_user_id, title, status, current_stage,
				primary_content_locale, supported_content_locales, settings, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $10)
		`, record.ID, record.OrganizationID, record.OwnerUserID, record.Title, status, currentStage, primaryLocale, pq.Array(supportedLocales), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert project %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Episodes {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO episodes (
				id, project_id, episode_no, title, lifecycle_status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, 'draft', $5, $6)
		`, record.ID, record.ProjectID, record.EpisodeNo, record.Title, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert episode %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Scenes {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO scenes (
				id, project_id, episode_id, scene_no, title, source_locale, lifecycle_status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
		`, record.ID, record.ProjectID, record.EpisodeID, record.SceneNo, record.Title, emptyToNil(record.SourceLocale), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert scene %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Shots {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shots (
				id, scene_id, shot_no, code, title, source_locale, lifecycle_status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
		`, record.ID, record.SceneID, record.ShotNo, emptyToNil(record.Code), emptyToNil(record.Title), emptyToNil(record.SourceLocale), record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert shot %s: %w", record.ID, err)
		}
	}

	snapshotRecords := make([]content.Snapshot, 0, len(snapshot.Snapshots))
	for _, record := range snapshot.Snapshots {
		snapshotRecords = append(snapshotRecords, record)
	}
	sort.Slice(snapshotRecords, func(i, j int) bool {
		leftSource := strings.TrimSpace(snapshotRecords[i].SourceSnapshotID)
		rightSource := strings.TrimSpace(snapshotRecords[j].SourceSnapshotID)
		if leftSource == "" && rightSource != "" {
			return true
		}
		if leftSource != "" && rightSource == "" {
			return false
		}
		if snapshotRecords[i].CreatedAt.Equal(snapshotRecords[j].CreatedAt) {
			return snapshotRecords[i].ID < snapshotRecords[j].ID
		}
		return snapshotRecords[i].CreatedAt.Before(snapshotRecords[j].CreatedAt)
	})

	for _, record := range snapshotRecords {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO content_snapshots (
				id, resource_type, resource_id, snapshot_kind, locale, translation_group_id,
				source_snapshot_id, translation_status, body, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, record.ID, record.OwnerType, record.OwnerID, defaultString(strings.TrimSpace(record.SnapshotKind), content.SnapshotKindContent), record.Locale, normalizeSnapshotGroupID(record.TranslationGroupID), nullableUUID(record.SourceSnapshotID), defaultString(record.TranslationStatus, "source"), record.Body, record.CreatedAt, record.UpdatedAt); err != nil {
			return fmt.Errorf("db: insert content snapshot %s: %w", record.ID, err)
		}
	}

	return nil
}

func (p *PostgresPersister) saveExecutionsAssetsReviewBilling(ctx context.Context, tx *sql.Tx, snapshot Snapshot) (map[string]string, map[string]string, error) {
	for _, record := range snapshot.ShotExecutions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shot_executions (
				id, organization_id, project_id, shot_id, status, current_run_id, primary_asset_id, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)
		`, record.ID, record.OrgID, record.ProjectID, record.ShotID, defaultString(record.Status, "pending"), nullableUUID(record.PrimaryAssetID), record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert shot execution %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.ShotExecutionRuns {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shot_execution_runs (
				id, shot_execution_id, run_number, run_type, status, trigger_source, created_by_user_id,
				started_at, created_at, updated_at
			) VALUES ($1, $2, $3, 'generate', $4, $5, $6, $7, $8, $9)
		`, record.ID, record.ShotExecutionID, record.RunNumber, defaultString(record.Status, "pending"), defaultString(record.TriggerType, "manual"), nullableUUID(record.OperatorID), record.CreatedAt, record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert shot execution run %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.ShotExecutions {
		if _, err := tx.ExecContext(ctx, `
			UPDATE shot_executions
			SET current_run_id = $2, primary_asset_id = $3, updated_at = $4
			WHERE id = $1
		`, record.ID, nullableUUID(record.CurrentRunID), nullableUUID(record.PrimaryAssetID), record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: update shot execution %s refs: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.ImportBatches {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO import_batches (
				id, organization_id, project_id, status, source_type, created_by_user_id, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, record.ID, record.OrgID, record.ProjectID, defaultString(record.Status, "pending"), defaultString(record.SourceType, "upload_session"), nullableUUID(record.OperatorID), record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert import batch %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.UploadSessions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO upload_sessions (
				id, organization_id, project_id, import_batch_id, status, storage_provider,
				object_key_prefix, expires_at, created_at, updated_at, completed_at,
				file_name, checksum_sha256, size_bytes, retry_count, resume_hint, last_retry_at
			) VALUES ($1, $2, $3, $4, $5, 'dev-local', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		`, record.ID, record.OrgID, nullableUUID(record.ProjectID), nullableUUID(record.ImportBatchID), normalizeUploadSessionStatusForDB(record.Status, record.ExpiresAt), fmt.Sprintf("uploads/%s", record.ID), record.ExpiresAt, record.CreatedAt, record.CreatedAt, nullableTime(ifStatusUploaded(record.Status, record.CreatedAt)), emptyToNil(record.FileName), emptyToNil(record.Checksum), nullableInt64(record.SizeBytes), record.RetryCount, emptyToNil(record.ResumeHint), nullableTime(record.LastRetryAt)); err != nil {
			return nil, nil, fmt.Errorf("db: insert upload session %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.UploadFiles {
		status := "pending"
		if session, ok := snapshot.UploadSessions[record.UploadSessionID]; ok && strings.TrimSpace(session.Status) == "uploaded" {
			status = "uploaded"
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO upload_files (
				id, upload_session_id, original_file_name, mime_type, file_size_bytes,
				checksum_sha256, storage_key, status, uploaded_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, record.ID, record.UploadSessionID, record.FileName, emptyToNil(record.MimeType), nullableInt64(record.SizeBytes), emptyToNil(record.Checksum), fmt.Sprintf("upload-files/%s", record.ID), status, nullableTime(record.CreatedAt), record.CreatedAt, record.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert upload file %s: %w", record.ID, err)
		}
	}

	assetUploadFiles := make(map[string]string)
	for _, variant := range snapshot.MediaAssetVariants {
		if strings.TrimSpace(variant.UploadFileID) != "" {
			assetUploadFiles[variant.AssetID] = variant.UploadFileID
		}
	}
	for _, record := range snapshot.MediaAssets {
		aiDisclosureStatus := "unknown"
		if record.AIAnnotated {
			aiDisclosureStatus = "completed"
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO media_assets (
				id, organization_id, project_id, import_batch_id, upload_file_id, asset_type,
				source_type, storage_key, ai_disclosure_status, rights_status, consent_status,
				created_at, updated_at, locale, ai_annotated
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unknown', $11, $12, $13, $14)
		`, record.ID, record.OrgID, record.ProjectID, nullableUUID(record.ImportBatchID), nullableUUID(assetUploadFiles[record.ID]), normalizeAssetMediaType(record.MediaType), defaultString(record.SourceType, "upload_session"), fmt.Sprintf("media-assets/%s", record.ID), aiDisclosureStatus, defaultString(record.RightsStatus, "unknown"), record.CreatedAt, record.UpdatedAt, emptyToNil(record.Locale), record.AIAnnotated); err != nil {
			return nil, nil, fmt.Errorf("db: insert media asset %s: %w", record.ID, err)
		}
	}

	assetItemIDs := make(map[string]string)
	for _, record := range snapshot.ImportBatchItems {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO import_batch_items (
				id, import_batch_id, upload_file_id, media_asset_id, matched_shot_id, status,
				parsed_metadata, created_at, updated_at, reviewed_at
			) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7, $8, $9)
		`, record.ID, record.ImportBatchID, nullableUUID(assetUploadFiles[record.AssetID]), nullableUUID(record.AssetID), nullableUUID(record.MatchedShotID), defaultString(record.Status, "parsed"), record.CreatedAt, record.UpdatedAt, nullableTime(reviewedAtForItem(record))); err != nil {
			return nil, nil, fmt.Errorf("db: insert import batch item %s: %w", record.ID, err)
		}
		if strings.TrimSpace(record.AssetID) != "" {
			assetItemIDs[record.AssetID] = record.ID
		}
	}

	for _, record := range snapshot.MediaAssetVariants {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO media_asset_variants (
				id, media_asset_id, variant_type, storage_key, mime_type, width, height, duration_ms, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, record.ID, record.AssetID, defaultString(record.VariantType, "original"), fmt.Sprintf("media-asset-variants/%s", record.ID), emptyToNil(record.MimeType), nullableInt(record.Width), nullableInt(record.Height), nullableInt(record.DurationMS), record.CreatedAt, record.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert media asset variant %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.CandidateAssets {
		selectionStatus := "candidate"
		if shotExecution, ok := snapshot.ShotExecutions[record.ShotExecutionID]; ok && shotExecution.PrimaryAssetID == record.AssetID {
			selectionStatus = "selected_primary"
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shot_candidate_assets (
				id, shot_execution_id, media_asset_id, source_run_id, source_import_batch_item_id,
				selection_status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, record.ID, record.ShotExecutionID, record.AssetID, nullableUUID(record.SourceRunID), nullableUUID(assetItemIDs[record.AssetID]), selectionStatus, record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert shot candidate asset %s: %w", record.ID, err)
		}
	}

	budgetIDsByProject := make(map[string]string)
	for _, record := range snapshot.Budgets {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO budget_policies (
				id, organization_id, project_id, policy_name, policy_mode, currency_code,
				max_budget_units, status, created_at, updated_at
			) VALUES ($1, $2, $3, 'default', 'hard_stop', 'CNY', $4, 'active', $5, $6)
		`, record.ID, record.OrgID, record.ProjectID, record.LimitCents, record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert budget policy %s: %w", record.ID, err)
		}
		budgetIDsByProject[record.ProjectID] = record.ID
	}

	usageIDsByRun := make(map[string]string)
	for _, record := range snapshot.UsageRecords {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO usage_records (
				id, organization_id, project_id, shot_execution_run_id, usage_type,
				total_cost_units, currency_code, recorded_at, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, 'CNY', $7, $8)
		`, record.ID, record.OrgID, record.ProjectID, nullableUUID(record.ShotExecutionRunID), defaultString(record.Meter, "shot_execution_run"), record.AmountCents, record.CreatedAt, record.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert usage record %s: %w", record.ID, err)
		}
		if strings.TrimSpace(record.ShotExecutionRunID) != "" {
			usageIDsByRun[record.ShotExecutionRunID] = record.ID
		}
	}

	for _, record := range snapshot.EvaluationRuns {
		shotExecution, ok := snapshot.ShotExecutions[record.ShotExecutionID]
		if !ok {
			continue
		}
		failedChecks := record.FailedChecks
		if failedChecks == nil {
			failedChecks = []string{}
		}
		summaryText, err := jsonString(evaluationSummaryPayload{
			PassedChecks: record.PassedChecks,
			FailedChecks: record.FailedChecks,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("db: encode evaluation run %s: %w", record.ID, err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO evaluation_runs (
				id, organization_id, project_id, shot_execution_id, shot_execution_run_id,
				evaluation_type, status, result_summary, failure_codes, started_at, completed_at,
				created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, 'submission_gate', $6, $7::jsonb, $8, $9, $10, $11, $12)
		`, record.ID, shotExecution.OrgID, shotExecution.ProjectID, record.ShotExecutionID, nullableUUID(shotExecution.CurrentRunID), defaultString(record.Status, "passed"), summaryText, pq.Array(failedChecks), record.CreatedAt, record.CreatedAt, record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert evaluation run %s: %w", record.ID, err)
		}
	}

	for _, record := range snapshot.Reviews {
		shotExecution, ok := snapshot.ShotExecutions[record.ShotExecutionID]
		if !ok {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shot_reviews (
				id, organization_id, project_id, shot_execution_id, shot_execution_run_id,
				conclusion, comment_locale, comment_body, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, record.ID, shotExecution.OrgID, shotExecution.ProjectID, record.ShotExecutionID, nullableUUID(shotExecution.CurrentRunID), defaultString(record.Conclusion, "commented"), defaultString(record.CommentLocale, "zh-CN"), emptyToNil(record.Comment), record.CreatedAt, record.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("db: insert shot review %s: %w", record.ID, err)
		}
	}

	return usageIDsByRun, budgetIDsByProject, nil
}

func (p *PostgresPersister) saveBillingEvents(ctx context.Context, tx *sql.Tx, snapshot Snapshot, usageIDsByRun map[string]string, budgetIDsByProject map[string]string) error {
	for _, record := range snapshot.BillingEvents {
		payloadText, err := jsonString(map[string]any{
			"amount_cents":          record.AmountCents,
			"shot_execution_id":     record.ShotExecutionID,
			"shot_execution_run_id": record.ShotExecutionRunID,
		})
		if err != nil {
			return fmt.Errorf("db: encode billing event %s: %w", record.ID, err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO billing_events (
				id, organization_id, project_id, usage_record_id, budget_policy_id,
				event_type, severity, message_key, payload, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, 'info', $7, $8::jsonb, $9)
		`, record.ID, record.OrgID, record.ProjectID, nullableUUID(usageIDsByRun[record.ShotExecutionRunID]), nullableUUID(budgetIDsByProject[record.ProjectID]), defaultString(record.EventType, "info"), defaultString(record.EventType, "info"), payloadText, record.CreatedAt); err != nil {
			return fmt.Errorf("db: insert billing event %s: %w", record.ID, err)
		}
	}
	return nil
}
