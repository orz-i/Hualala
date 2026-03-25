package db

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/gateway"
	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/events"
)

type RuntimeStore interface {
	AuthOrgRepository
	ProjectContentRepository
	ExecutionRepository
	AssetRepository
	ReviewBillingRepository
	ModelGovernanceRepository
	PolicyReader
	GatewayResultStore
	WorkflowRepository
	SaveAudioRuntimeAndWorkflowRun(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun) error
	SaveAudioRuntimeAndWorkflowDispatch(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun, workflowStep workflow.WorkflowStep, job workflow.Job, transition workflow.StateTransition) error
	Publisher() *events.Publisher
}

type AuthOrgRepository interface {
	GetOrganization(orgID string) (org.Organization, bool)
	SaveOrganization(ctx context.Context, record org.Organization) error

	GetUser(userID string) (auth.User, bool)
	SaveUser(ctx context.Context, record auth.User) error

	GetMembership(memberID string) (org.Member, bool)
	FindMembership(orgID string, userID string) (org.Member, bool)
	ListMembersByOrganization(orgID string) []org.Member
	SaveMembership(ctx context.Context, record org.Member) error

	GetRole(roleID string) (org.Role, bool)
	ListRolesByOrganization(orgID string) []org.Role
	SaveRole(ctx context.Context, record org.Role) error
	DeleteRole(ctx context.Context, roleID string) error

	ListRolePermissions(roleID string) []string
	ReplaceRolePermissions(ctx context.Context, roleID string, permissions []string) error
}

type ProjectContentRepository interface {
	GenerateProjectID() string
	SaveProject(ctx context.Context, record project.Project) error
	GetProject(projectID string) (project.Project, bool)
	ListProjectsByOrganization(organizationID string) []project.Project

	GenerateEpisodeID() string
	SaveEpisode(ctx context.Context, record project.Episode) error
	GetEpisode(episodeID string) (project.Episode, bool)
	ListEpisodesByProject(projectID string) []project.Episode

	GenerateSceneID() string
	SaveScene(ctx context.Context, record content.Scene) error
	GetScene(sceneID string) (content.Scene, bool)
	ListScenesByIDs(sceneIDs []string) []content.Scene
	ListScenes(projectID string, episodeID string) []content.Scene

	GenerateShotID() string
	SaveShot(ctx context.Context, record content.Shot) error
	GetShot(shotID string) (content.Shot, bool)
	ListShotsByIDs(shotIDs []string) []content.Shot
	ListShotsByScene(sceneID string) []content.Shot
	GetCollaborationScope(ownerType string, ownerID string) (string, string, error)

	GenerateSnapshotID() string
	GenerateTranslationGroupID() string
	SaveSnapshot(ctx context.Context, record content.Snapshot) error
	GetSnapshot(snapshotID string) (content.Snapshot, bool)
	ListSnapshotsByOwner(ownerType string, ownerID string) []content.Snapshot
	ListSnapshotsByOwners(ownerType string, ownerIDs []string) []content.Snapshot

	GenerateCollaborationSessionID() string
	SaveCollaborationSession(ctx context.Context, record content.CollaborationSession) error
	GetCollaborationSession(ownerType string, ownerID string) (content.CollaborationSession, bool)

	GenerateCollaborationPresenceID() string
	SaveCollaborationPresence(ctx context.Context, record content.CollaborationPresence) error
	GetCollaborationPresence(sessionID string, userID string) (content.CollaborationPresence, bool)
	ListCollaborationPresences(sessionID string) []content.CollaborationPresence

	GeneratePreviewAssemblyID() string
	SavePreviewAssembly(ctx context.Context, record project.PreviewAssembly) error
	GetPreviewAssembly(projectID string, episodeID string) (project.PreviewAssembly, bool)

	GeneratePreviewAssemblyItemID() string
	ReplacePreviewAssemblyItems(ctx context.Context, assemblyID string, items []project.PreviewAssemblyItem) error
	ListPreviewAssemblyItems(assemblyID string) []project.PreviewAssemblyItem

	GeneratePreviewRuntimeID() string
	SavePreviewRuntime(ctx context.Context, record project.PreviewRuntime) error
	GetPreviewRuntime(projectID string, episodeID string) (project.PreviewRuntime, bool)
	GetPreviewRuntimeByID(previewRuntimeID string) (project.PreviewRuntime, bool)

	GenerateAudioRuntimeID() string
	SaveAudioRuntime(ctx context.Context, record project.AudioRuntime) error
	GetAudioRuntime(projectID string, episodeID string) (project.AudioRuntime, bool, error)
	GetAudioRuntimeByID(audioRuntimeID string) (project.AudioRuntime, bool, error)

	GenerateAudioTimelineID() string
	SaveAudioTimeline(ctx context.Context, record project.AudioTimeline) error
	GetAudioTimeline(projectID string, episodeID string) (project.AudioTimeline, bool)

	GenerateAudioTrackID() string
	ReplaceAudioTracks(ctx context.Context, timelineID string, tracks []project.AudioTrack) error
	ListAudioTracks(timelineID string) []project.AudioTrack

	GenerateAudioClipID() string
	ReplaceAudioClips(ctx context.Context, trackID string, clips []project.AudioClip) error
	ListAudioClips(trackID string) []project.AudioClip
}

type ExecutionRepository interface {
	GenerateShotExecutionID() string
	SaveShotExecution(ctx context.Context, record execution.ShotExecution) error
	GetShotExecution(shotExecutionID string) (execution.ShotExecution, bool)
	FindShotExecutionByShotID(shotID string) (execution.ShotExecution, bool)
	ListShotExecutionsByShotIDs(shotIDs []string) []execution.ShotExecution
	ListShotExecutionsByIDs(ids []string) []execution.ShotExecution

	GenerateShotExecutionRunID() string
	SaveShotExecutionRun(ctx context.Context, record execution.ShotExecutionRun) error
	ListShotExecutionRuns(shotExecutionID string) []execution.ShotExecutionRun
	ListShotExecutionRunsByExecutionIDs(shotExecutionIDs []string) []execution.ShotExecutionRun
}

type AssetRepository interface {
	GenerateImportBatchID() string
	SaveImportBatch(ctx context.Context, record asset.ImportBatch) error
	GetImportBatch(importBatchID string) (asset.ImportBatch, bool)
	ListImportBatches(projectID string, status string, sourceType string) []asset.ImportBatch
	ListImportBatchStats(importBatchIDs []string) map[string]ImportBatchStats

	GenerateImportBatchItemID() string
	SaveImportBatchItem(ctx context.Context, record asset.ImportBatchItem) error
	GetImportBatchItem(itemID string) (asset.ImportBatchItem, bool)
	ListImportBatchItems(importBatchID string) []asset.ImportBatchItem

	GenerateUploadSessionID() string
	SaveUploadSession(ctx context.Context, record asset.UploadSession) error
	GetUploadSession(sessionID string) (asset.UploadSession, bool)
	ListUploadSessionsByImportBatch(importBatchID string) []asset.UploadSession

	GenerateUploadFileID() string
	SaveUploadFile(ctx context.Context, record asset.UploadFile) error
	ListUploadFilesBySessionIDs(sessionIDs []string) []asset.UploadFile

	GenerateMediaAssetID() string
	SaveMediaAsset(ctx context.Context, record asset.MediaAsset) error
	GetMediaAsset(assetID string) (asset.MediaAsset, bool)
	ListMediaAssetsByIDs(assetIDs []string) []asset.MediaAsset
	ListMediaAssetsByImportBatch(importBatchID string) []asset.MediaAsset

	GenerateMediaAssetVariantID() string
	SaveMediaAssetVariant(ctx context.Context, record asset.MediaAssetVariant) error
	ListMediaAssetVariantsByUploadFileIDs(uploadFileIDs []string) []asset.MediaAssetVariant
	ListMediaAssetVariantsByAssetIDs(assetIDs []string) []asset.MediaAssetVariant

	GenerateCandidateAssetID() string
	SaveCandidateAsset(ctx context.Context, record asset.CandidateAsset) error
	ListCandidateAssetsByExecution(shotExecutionID string) []asset.CandidateAsset
	ListCandidateAssetsByAssetIDs(assetIDs []string) []asset.CandidateAsset
}

type ImportBatchStats struct {
	UploadSessionCount  int
	ItemCount           int
	ConfirmedItemCount  int
	CandidateAssetCount int
	MediaAssetCount     int
}

type ReviewBillingRepository interface {
	GenerateReviewID() string
	SaveReview(ctx context.Context, record review.ShotReview) error
	ListReviewsByExecution(shotExecutionID string) []review.ShotReview

	GenerateEvaluationRunID() string
	SaveEvaluationRun(ctx context.Context, record review.EvaluationRun) error
	ListEvaluationRunsByExecution(shotExecutionID string) []review.EvaluationRun

	GenerateBudgetID() string
	SaveBudget(ctx context.Context, record billing.ProjectBudget) error
	GetBudgetByProject(projectID string) (billing.ProjectBudget, bool)

	GenerateUsageRecordID() string
	SaveUsageRecord(ctx context.Context, record billing.UsageRecord) error
	ListUsageRecordsByProject(projectID string) []billing.UsageRecord

	GenerateBillingEventID() string
	SaveBillingEvent(ctx context.Context, record billing.BillingEvent) error
	ListBillingEventsByProject(projectID string) []billing.BillingEvent
}

type ModelGovernanceRepository interface {
	GenerateModelProfileID() string
	SaveModelProfile(ctx context.Context, record modelgovernance.ModelProfile) error
	GetModelProfile(modelProfileID string) (modelgovernance.ModelProfile, bool)
	ListModelProfiles(orgID string, capabilityType string, status string) []modelgovernance.ModelProfile

	GeneratePromptTemplateID() string
	SavePromptTemplate(ctx context.Context, record modelgovernance.PromptTemplate) error
	GetPromptTemplate(promptTemplateID string) (modelgovernance.PromptTemplate, bool)
	ListPromptTemplates(orgID string, templateKey string, locale string, status string) []modelgovernance.PromptTemplate

	GenerateContextBundleID() string
	SaveContextBundle(ctx context.Context, record modelgovernance.ContextBundle) error
	GetContextBundle(contextBundleID string) (modelgovernance.ContextBundle, bool)
	ListContextBundles(orgID string, projectID string, shotID string, shotExecutionID string, modelProfileID string, promptTemplateID string) []modelgovernance.ContextBundle
}

type PolicyReader interface {
	GetBudgetByProject(projectID string) (billing.ProjectBudget, bool)
}

type GatewayResultStore interface {
	GetGatewayResult(idempotencyKey string) (gateway.GatewayResult, bool)
	SaveGatewayResult(ctx context.Context, idempotencyKey string, result gateway.GatewayResult) error
	GenerateGatewayExternalRequestID() string
}

type WorkflowRepository interface {
	GenerateWorkflowRunID() string
	GenerateWorkflowStepID() string
	GenerateJobID() string
	GenerateStateTransitionID() string
	SaveWorkflowRun(ctx context.Context, record workflow.WorkflowRun) error
	SaveWorkflowStep(ctx context.Context, record workflow.WorkflowStep) error
	SaveJob(ctx context.Context, record workflow.Job) error
	SaveStateTransition(ctx context.Context, record workflow.StateTransition) error
	GetWorkflowRun(workflowRunID string) (workflow.WorkflowRun, bool)
	GetJob(jobID string) (workflow.Job, bool)
	ListWorkflowSteps(workflowRunID string) []workflow.WorkflowStep
	ListWorkflowRuns(projectID, resourceID, status, workflowType string) []workflow.WorkflowRun
	ListJobs(resourceType, resourceID, jobType, status string) []workflow.Job
	ListStateTransitions(resourceType, resourceID string) []workflow.StateTransition
	ClaimNextJob(ctx context.Context, jobType string) (workflow.Job, bool, error)
}

func (s *MemoryStore) save(ctx context.Context, mutate func()) error {
	if s == nil {
		return nil
	}
	mutate()
	return s.Persist(ctx)
}

func (s *MemoryStore) GenerateProjectID() string          { return s.NextProjectID() }
func (s *MemoryStore) GenerateEpisodeID() string          { return s.NextEpisodeID() }
func (s *MemoryStore) GenerateSceneID() string            { return s.NextSceneID() }
func (s *MemoryStore) GenerateShotID() string             { return s.NextShotID() }
func (s *MemoryStore) GenerateSnapshotID() string         { return s.NextSnapshotID() }
func (s *MemoryStore) GenerateTranslationGroupID() string { return s.NextTranslationGroupID() }
func (s *MemoryStore) GenerateCollaborationSessionID() string {
	return s.NextCollaborationSessionID()
}
func (s *MemoryStore) GenerateCollaborationPresenceID() string {
	return s.NextCollaborationPresenceID()
}
func (s *MemoryStore) GeneratePreviewAssemblyID() string { return s.NextPreviewAssemblyID() }
func (s *MemoryStore) GeneratePreviewAssemblyItemID() string {
	return s.NextPreviewAssemblyItemID()
}
func (s *MemoryStore) GeneratePreviewRuntimeID() string    { return s.NextPreviewRuntimeID() }
func (s *MemoryStore) GenerateAudioRuntimeID() string      { return s.NextAudioRuntimeID() }
func (s *MemoryStore) GenerateAudioTimelineID() string     { return s.NextAudioTimelineID() }
func (s *MemoryStore) GenerateAudioTrackID() string        { return s.NextAudioTrackID() }
func (s *MemoryStore) GenerateAudioClipID() string         { return s.NextAudioClipID() }
func (s *MemoryStore) GenerateShotExecutionID() string     { return s.NextShotExecutionID() }
func (s *MemoryStore) GenerateShotExecutionRunID() string  { return s.NextShotExecutionRunID() }
func (s *MemoryStore) GenerateImportBatchID() string       { return s.NextImportBatchID() }
func (s *MemoryStore) GenerateImportBatchItemID() string   { return s.NextImportBatchItemID() }
func (s *MemoryStore) GenerateUploadSessionID() string     { return s.NextUploadSessionID() }
func (s *MemoryStore) GenerateUploadFileID() string        { return s.NextUploadFileID() }
func (s *MemoryStore) GenerateMediaAssetID() string        { return s.NextMediaAssetID() }
func (s *MemoryStore) GenerateMediaAssetVariantID() string { return s.NextMediaAssetVariantID() }
func (s *MemoryStore) GenerateCandidateAssetID() string    { return s.NextCandidateAssetID() }
func (s *MemoryStore) GenerateReviewID() string            { return s.NextReviewID() }
func (s *MemoryStore) GenerateEvaluationRunID() string     { return s.NextEvaluationRunID() }
func (s *MemoryStore) GenerateBudgetID() string            { return s.NextBudgetID() }
func (s *MemoryStore) GenerateUsageRecordID() string       { return s.NextUsageRecordID() }
func (s *MemoryStore) GenerateBillingEventID() string      { return s.NextBillingEventID() }
func (s *MemoryStore) GenerateWorkflowRunID() string       { return s.NextWorkflowRunID() }
func (s *MemoryStore) GenerateWorkflowStepID() string      { return s.NextWorkflowStepID() }
func (s *MemoryStore) GenerateJobID() string               { return s.NextJobID() }
func (s *MemoryStore) GenerateStateTransitionID() string   { return s.NextStateTransitionID() }
func (s *MemoryStore) GenerateGatewayExternalRequestID() string {
	return s.NextGatewayExternalRequestID()
}

func (s *MemoryStore) GetOrganization(orgID string) (org.Organization, bool) {
	record, ok := s.Organizations[orgID]
	return record, ok
}

func (s *MemoryStore) SaveOrganization(ctx context.Context, record org.Organization) error {
	return s.save(ctx, func() { s.Organizations[record.ID] = record })
}

func (s *MemoryStore) GetUser(userID string) (auth.User, bool) {
	record, ok := s.Users[userID]
	return record, ok
}

func (s *MemoryStore) SaveUser(ctx context.Context, record auth.User) error {
	return s.save(ctx, func() { s.Users[record.ID] = record })
}

func (s *MemoryStore) GetMembership(memberID string) (org.Member, bool) {
	record, ok := s.Memberships[memberID]
	return record, ok
}

func (s *MemoryStore) FindMembership(orgID string, userID string) (org.Member, bool) {
	for _, record := range s.Memberships {
		if record.OrgID == orgID && record.UserID == userID {
			return record, true
		}
	}
	return org.Member{}, false
}

func (s *MemoryStore) ListMembersByOrganization(orgID string) []org.Member {
	items := make([]org.Member, 0)
	for _, record := range s.Memberships {
		if record.OrgID == orgID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveMembership(ctx context.Context, record org.Member) error {
	return s.save(ctx, func() { s.Memberships[record.ID] = record })
}

func (s *MemoryStore) GetRole(roleID string) (org.Role, bool) {
	record, ok := s.Roles[roleID]
	return record, ok
}

func (s *MemoryStore) ListRolesByOrganization(orgID string) []org.Role {
	items := make([]org.Role, 0)
	for _, record := range s.Roles {
		if record.OrgID == orgID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveRole(ctx context.Context, record org.Role) error {
	return s.save(ctx, func() { s.Roles[record.ID] = record })
}

func (s *MemoryStore) DeleteRole(ctx context.Context, roleID string) error {
	return s.save(ctx, func() {
		delete(s.Roles, roleID)
		delete(s.RolePermissions, roleID)
	})
}

func (s *MemoryStore) ListRolePermissions(roleID string) []string {
	return append([]string(nil), s.RolePermissions[roleID]...)
}

func (s *MemoryStore) ReplaceRolePermissions(ctx context.Context, roleID string, permissions []string) error {
	return s.save(ctx, func() { s.RolePermissions[roleID] = append([]string(nil), permissions...) })
}

func (s *MemoryStore) SaveProject(ctx context.Context, record project.Project) error {
	return s.save(ctx, func() { s.Projects[record.ID] = record })
}

func (s *MemoryStore) GetProject(projectID string) (project.Project, bool) {
	record, ok := s.Projects[projectID]
	return record, ok
}

func (s *MemoryStore) ListProjectsByOrganization(organizationID string) []project.Project {
	items := make([]project.Project, 0)
	for _, record := range s.Projects {
		if record.OrganizationID == organizationID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items
}

func (s *MemoryStore) SaveEpisode(ctx context.Context, record project.Episode) error {
	return s.save(ctx, func() { s.Episodes[record.ID] = record })
}

func (s *MemoryStore) GetEpisode(episodeID string) (project.Episode, bool) {
	record, ok := s.Episodes[episodeID]
	return record, ok
}

func (s *MemoryStore) ListEpisodesByProject(projectID string) []project.Episode {
	items := make([]project.Episode, 0)
	for _, record := range s.Episodes {
		if record.ProjectID == projectID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].EpisodeNo == items[j].EpisodeNo {
			return items[i].ID < items[j].ID
		}
		return items[i].EpisodeNo < items[j].EpisodeNo
	})
	return items
}

func (s *MemoryStore) SaveScene(ctx context.Context, record content.Scene) error {
	return s.save(ctx, func() { s.Scenes[record.ID] = record })
}

func (s *MemoryStore) GetScene(sceneID string) (content.Scene, bool) {
	record, ok := s.Scenes[sceneID]
	return record, ok
}

func (s *MemoryStore) ListScenesByIDs(sceneIDs []string) []content.Scene {
	lookup := make(map[string]struct{}, len(sceneIDs))
	for _, sceneID := range sceneIDs {
		normalizedID := strings.TrimSpace(sceneID)
		if normalizedID == "" {
			continue
		}
		lookup[normalizedID] = struct{}{}
	}
	items := make([]content.Scene, 0, len(lookup))
	for _, record := range s.Scenes {
		if _, ok := lookup[record.ID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) ListScenes(projectID string, episodeID string) []content.Scene {
	items := make([]content.Scene, 0)
	for _, record := range s.Scenes {
		if record.ProjectID == projectID && record.EpisodeID == episodeID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].SceneNo == items[j].SceneNo {
			return items[i].ID < items[j].ID
		}
		return items[i].SceneNo < items[j].SceneNo
	})
	return items
}

func (s *MemoryStore) SaveShot(ctx context.Context, record content.Shot) error {
	return s.save(ctx, func() { s.Shots[record.ID] = record })
}

func (s *MemoryStore) GetShot(shotID string) (content.Shot, bool) {
	record, ok := s.Shots[shotID]
	return record, ok
}

func (s *MemoryStore) ListShotsByIDs(shotIDs []string) []content.Shot {
	lookup := make(map[string]struct{}, len(shotIDs))
	for _, shotID := range shotIDs {
		normalizedID := strings.TrimSpace(shotID)
		if normalizedID == "" {
			continue
		}
		lookup[normalizedID] = struct{}{}
	}
	items := make([]content.Shot, 0, len(lookup))
	for _, record := range s.Shots {
		if _, ok := lookup[record.ID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) GetCollaborationScope(ownerType string, ownerID string) (string, string, error) {
	normalizedType := strings.TrimSpace(ownerType)
	normalizedID := strings.TrimSpace(ownerID)
	switch normalizedType {
	case "project":
		record, ok := s.GetProject(normalizedID)
		if !ok {
			return "", "", fmt.Errorf("db: project %q not found", normalizedID)
		}
		return record.OrganizationID, record.ID, nil
	case "episode":
		record, ok := s.GetEpisode(normalizedID)
		if !ok {
			return "", "", fmt.Errorf("db: episode %q not found", normalizedID)
		}
		projectRecord, ok := s.GetProject(record.ProjectID)
		if !ok {
			return "", "", fmt.Errorf("db: project %q not found", record.ProjectID)
		}
		return projectRecord.OrganizationID, projectRecord.ID, nil
	case "scene":
		record, ok := s.GetScene(normalizedID)
		if !ok {
			return "", "", fmt.Errorf("db: scene %q not found", normalizedID)
		}
		projectRecord, ok := s.GetProject(record.ProjectID)
		if !ok {
			return "", "", fmt.Errorf("db: project %q not found", record.ProjectID)
		}
		return projectRecord.OrganizationID, projectRecord.ID, nil
	case "shot":
		record, ok := s.GetShot(normalizedID)
		if !ok {
			return "", "", fmt.Errorf("db: shot %q not found", normalizedID)
		}
		sceneRecord, ok := s.GetScene(record.SceneID)
		if !ok {
			return "", "", fmt.Errorf("db: scene %q not found", record.SceneID)
		}
		projectRecord, ok := s.GetProject(sceneRecord.ProjectID)
		if !ok {
			return "", "", fmt.Errorf("db: project %q not found", sceneRecord.ProjectID)
		}
		return projectRecord.OrganizationID, projectRecord.ID, nil
	default:
		return "", "", fmt.Errorf("db: owner_type %q is invalid", normalizedType)
	}
}

func (s *MemoryStore) ListShotsByScene(sceneID string) []content.Shot {
	items := make([]content.Shot, 0)
	for _, record := range s.Shots {
		if record.SceneID == sceneID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].ShotNo == items[j].ShotNo {
			return items[i].ID < items[j].ID
		}
		return items[i].ShotNo < items[j].ShotNo
	})
	return items
}

func (s *MemoryStore) SaveSnapshot(ctx context.Context, record content.Snapshot) error {
	return s.save(ctx, func() { s.Snapshots[record.ID] = record })
}

func (s *MemoryStore) GetSnapshot(snapshotID string) (content.Snapshot, bool) {
	record, ok := s.Snapshots[snapshotID]
	return record, ok
}

func (s *MemoryStore) ListSnapshotsByOwner(ownerType string, ownerID string) []content.Snapshot {
	items := make([]content.Snapshot, 0)
	for _, record := range s.Snapshots {
		if record.OwnerType == ownerType && record.OwnerID == ownerID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
	return items
}

func (s *MemoryStore) ListSnapshotsByOwners(ownerType string, ownerIDs []string) []content.Snapshot {
	if len(ownerIDs) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(ownerIDs))
	for _, ownerID := range ownerIDs {
		normalizedOwnerID := strings.TrimSpace(ownerID)
		if normalizedOwnerID == "" {
			continue
		}
		allowed[normalizedOwnerID] = struct{}{}
	}
	items := make([]content.Snapshot, 0)
	for _, record := range s.Snapshots {
		if record.OwnerType != ownerType {
			continue
		}
		if _, ok := allowed[record.OwnerID]; !ok {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].OwnerID == items[j].OwnerID {
			return items[i].ID < items[j].ID
		}
		return items[i].OwnerID < items[j].OwnerID
	})
	return items
}

func (s *MemoryStore) SaveCollaborationSession(ctx context.Context, record content.CollaborationSession) error {
	return s.save(ctx, func() { s.CollaborationSessions[record.ID] = record })
}

func (s *MemoryStore) GetCollaborationSession(ownerType string, ownerID string) (content.CollaborationSession, bool) {
	for _, record := range s.CollaborationSessions {
		if record.OwnerType == ownerType && record.OwnerID == ownerID {
			return record, true
		}
	}
	return content.CollaborationSession{}, false
}

func (s *MemoryStore) SaveCollaborationPresence(ctx context.Context, record content.CollaborationPresence) error {
	return s.save(ctx, func() { s.CollaborationPresences[record.ID] = record })
}

func (s *MemoryStore) GetCollaborationPresence(sessionID string, userID string) (content.CollaborationPresence, bool) {
	for _, record := range s.CollaborationPresences {
		if record.SessionID == sessionID && record.UserID == userID {
			return record, true
		}
	}
	return content.CollaborationPresence{}, false
}

func (s *MemoryStore) ListCollaborationPresences(sessionID string) []content.CollaborationPresence {
	items := make([]content.CollaborationPresence, 0)
	for _, record := range s.CollaborationPresences {
		if record.SessionID == sessionID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if !items[i].UpdatedAt.Equal(items[j].UpdatedAt) {
			return items[i].UpdatedAt.Before(items[j].UpdatedAt)
		}
		return items[i].ID < items[j].ID
	})
	return items
}

func (s *MemoryStore) SavePreviewAssembly(ctx context.Context, record project.PreviewAssembly) error {
	return s.save(ctx, func() { s.PreviewAssemblies[record.ID] = record })
}

func (s *MemoryStore) GetPreviewAssembly(projectID string, episodeID string) (project.PreviewAssembly, bool) {
	for _, record := range s.PreviewAssemblies {
		if record.ProjectID == projectID && record.EpisodeID == episodeID {
			return record, true
		}
	}
	return project.PreviewAssembly{}, false
}

func (s *MemoryStore) ReplacePreviewAssemblyItems(ctx context.Context, assemblyID string, items []project.PreviewAssemblyItem) error {
	return s.save(ctx, func() {
		for id, record := range s.PreviewAssemblyItems {
			if record.AssemblyID == assemblyID {
				delete(s.PreviewAssemblyItems, id)
			}
		}
		for _, item := range items {
			s.PreviewAssemblyItems[item.ID] = item
		}
	})
}

func (s *MemoryStore) ListPreviewAssemblyItems(assemblyID string) []project.PreviewAssemblyItem {
	items := make([]project.PreviewAssemblyItem, 0)
	for _, record := range s.PreviewAssemblyItems {
		if record.AssemblyID == assemblyID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Sequence == items[j].Sequence {
			return items[i].ID < items[j].ID
		}
		return items[i].Sequence < items[j].Sequence
	})
	return items
}

func (s *MemoryStore) SavePreviewRuntime(ctx context.Context, record project.PreviewRuntime) error {
	return s.save(ctx, func() { s.PreviewRuntimes[record.ID] = record })
}

func (s *MemoryStore) GetPreviewRuntime(projectID string, episodeID string) (project.PreviewRuntime, bool) {
	for _, record := range s.PreviewRuntimes {
		if record.ProjectID == projectID && record.EpisodeID == episodeID {
			return record, true
		}
	}
	return project.PreviewRuntime{}, false
}

func (s *MemoryStore) GetPreviewRuntimeByID(previewRuntimeID string) (project.PreviewRuntime, bool) {
	record, ok := s.PreviewRuntimes[previewRuntimeID]
	return record, ok
}

func (s *MemoryStore) SaveAudioRuntime(ctx context.Context, record project.AudioRuntime) error {
	return s.save(ctx, func() { s.AudioRuntimes[record.ID] = cloneAudioRuntime(record) })
}

func (s *MemoryStore) SaveAudioRuntimeAndWorkflowRun(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun) error {
	return s.save(ctx, func() {
		s.AudioRuntimes[runtimeRecord.ID] = cloneAudioRuntime(runtimeRecord)
		s.WorkflowRuns[workflowRun.ID] = workflowRun
	})
}

func (s *MemoryStore) SaveAudioRuntimeAndWorkflowDispatch(ctx context.Context, runtimeRecord project.AudioRuntime, workflowRun workflow.WorkflowRun, workflowStep workflow.WorkflowStep, job workflow.Job, transition workflow.StateTransition) error {
	return s.save(ctx, func() {
		s.AudioRuntimes[runtimeRecord.ID] = cloneAudioRuntime(runtimeRecord)
		s.WorkflowRuns[workflowRun.ID] = workflowRun
		s.WorkflowSteps[workflowStep.ID] = workflowStep
		s.Jobs[job.ID] = job
		s.StateTransitions[transition.ID] = transition
	})
}

func (s *MemoryStore) GetAudioRuntime(projectID string, episodeID string) (project.AudioRuntime, bool, error) {
	for _, record := range s.AudioRuntimes {
		if record.ProjectID == projectID && record.EpisodeID == episodeID {
			return cloneAudioRuntime(record), true, nil
		}
	}
	return project.AudioRuntime{}, false, nil
}

func (s *MemoryStore) GetAudioRuntimeByID(audioRuntimeID string) (project.AudioRuntime, bool, error) {
	record, ok := s.AudioRuntimes[audioRuntimeID]
	if !ok {
		return project.AudioRuntime{}, false, nil
	}
	return cloneAudioRuntime(record), true, nil
}

func (s *MemoryStore) SaveAudioTimeline(ctx context.Context, record project.AudioTimeline) error {
	return s.save(ctx, func() { s.AudioTimelines[record.ID] = record })
}

func (s *MemoryStore) GetAudioTimeline(projectID string, episodeID string) (project.AudioTimeline, bool) {
	for _, record := range s.AudioTimelines {
		if record.ProjectID == projectID && record.EpisodeID == episodeID {
			return record, true
		}
	}
	return project.AudioTimeline{}, false
}

func (s *MemoryStore) ReplaceAudioTracks(ctx context.Context, timelineID string, tracks []project.AudioTrack) error {
	return s.save(ctx, func() {
		trackIDs := make(map[string]struct{})
		for id, record := range s.AudioTracks {
			if record.TimelineID != timelineID {
				continue
			}
			trackIDs[id] = struct{}{}
			delete(s.AudioTracks, id)
		}
		for id, record := range s.AudioClips {
			if _, ok := trackIDs[record.TrackID]; ok {
				delete(s.AudioClips, id)
			}
		}
		for _, track := range tracks {
			track.Clips = nil
			s.AudioTracks[track.ID] = track
		}
	})
}

func (s *MemoryStore) ListAudioTracks(timelineID string) []project.AudioTrack {
	items := make([]project.AudioTrack, 0)
	for _, record := range s.AudioTracks {
		if record.TimelineID == timelineID {
			record.Clips = nil
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Sequence == items[j].Sequence {
			return items[i].ID < items[j].ID
		}
		return items[i].Sequence < items[j].Sequence
	})
	return items
}

func (s *MemoryStore) ReplaceAudioClips(ctx context.Context, trackID string, clips []project.AudioClip) error {
	return s.save(ctx, func() {
		for id, record := range s.AudioClips {
			if record.TrackID == trackID {
				delete(s.AudioClips, id)
			}
		}
		for _, clip := range clips {
			s.AudioClips[clip.ID] = clip
		}
	})
}

func (s *MemoryStore) ListAudioClips(trackID string) []project.AudioClip {
	items := make([]project.AudioClip, 0)
	for _, record := range s.AudioClips {
		if record.TrackID == trackID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Sequence == items[j].Sequence {
			return items[i].ID < items[j].ID
		}
		return items[i].Sequence < items[j].Sequence
	})
	return items
}

func (s *MemoryStore) SaveShotExecution(ctx context.Context, record execution.ShotExecution) error {
	return s.save(ctx, func() { s.ShotExecutions[record.ID] = record })
}

func (s *MemoryStore) GetShotExecution(shotExecutionID string) (execution.ShotExecution, bool) {
	record, ok := s.ShotExecutions[shotExecutionID]
	return record, ok
}

func (s *MemoryStore) FindShotExecutionByShotID(shotID string) (execution.ShotExecution, bool) {
	for _, record := range s.ShotExecutions {
		if record.ShotID == shotID {
			return record, true
		}
	}
	return execution.ShotExecution{}, false
}

func (s *MemoryStore) ListShotExecutionsByShotIDs(shotIDs []string) []execution.ShotExecution {
	lookup := make(map[string]struct{}, len(shotIDs))
	for _, shotID := range shotIDs {
		normalizedID := strings.TrimSpace(shotID)
		if normalizedID == "" {
			continue
		}
		lookup[normalizedID] = struct{}{}
	}
	items := make([]execution.ShotExecution, 0, len(lookup))
	for _, record := range s.ShotExecutions {
		if _, ok := lookup[record.ShotID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) ListShotExecutionsByIDs(ids []string) []execution.ShotExecution {
	lookup := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		lookup[id] = struct{}{}
	}
	items := make([]execution.ShotExecution, 0, len(lookup))
	for _, record := range s.ShotExecutions {
		if _, ok := lookup[record.ID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveShotExecutionRun(ctx context.Context, record execution.ShotExecutionRun) error {
	return s.save(ctx, func() { s.ShotExecutionRuns[record.ID] = record })
}

func (s *MemoryStore) ListShotExecutionRuns(shotExecutionID string) []execution.ShotExecutionRun {
	items := make([]execution.ShotExecutionRun, 0)
	for _, record := range s.ShotExecutionRuns {
		if record.ShotExecutionID == shotExecutionID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].RunNumber == items[j].RunNumber {
			return items[i].ID < items[j].ID
		}
		return items[i].RunNumber < items[j].RunNumber
	})
	return items
}

func (s *MemoryStore) ListShotExecutionRunsByExecutionIDs(shotExecutionIDs []string) []execution.ShotExecutionRun {
	lookup := make(map[string]struct{}, len(shotExecutionIDs))
	for _, shotExecutionID := range shotExecutionIDs {
		normalizedID := strings.TrimSpace(shotExecutionID)
		if normalizedID == "" {
			continue
		}
		lookup[normalizedID] = struct{}{}
	}
	items := make([]execution.ShotExecutionRun, 0, len(lookup))
	for _, record := range s.ShotExecutionRuns {
		if _, ok := lookup[record.ShotExecutionID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].ShotExecutionID == items[j].ShotExecutionID {
			if items[i].RunNumber == items[j].RunNumber {
				return items[i].ID < items[j].ID
			}
			return items[i].RunNumber < items[j].RunNumber
		}
		return items[i].ShotExecutionID < items[j].ShotExecutionID
	})
	return items
}

func (s *MemoryStore) SaveImportBatch(ctx context.Context, record asset.ImportBatch) error {
	return s.save(ctx, func() { s.ImportBatches[record.ID] = record })
}

func (s *MemoryStore) GetImportBatch(importBatchID string) (asset.ImportBatch, bool) {
	record, ok := s.ImportBatches[importBatchID]
	return record, ok
}

func (s *MemoryStore) ListImportBatches(projectID string, status string, sourceType string) []asset.ImportBatch {
	items := make([]asset.ImportBatch, 0)
	for _, record := range s.ImportBatches {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}
		if status != "" && record.Status != status {
			continue
		}
		if sourceType != "" && record.SourceType != sourceType {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if !items[i].UpdatedAt.Equal(items[j].UpdatedAt) {
			return items[i].UpdatedAt.After(items[j].UpdatedAt)
		}
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		}
		return items[i].ID > items[j].ID
	})
	return items
}

func (s *MemoryStore) ListImportBatchStats(importBatchIDs []string) map[string]ImportBatchStats {
	lookup := make(map[string]struct{}, len(importBatchIDs))
	for _, id := range importBatchIDs {
		if id == "" {
			continue
		}
		lookup[id] = struct{}{}
	}
	stats := make(map[string]ImportBatchStats, len(lookup))
	if len(lookup) == 0 {
		return stats
	}

	for _, record := range s.UploadSessions {
		if _, ok := lookup[record.ImportBatchID]; !ok {
			continue
		}
		current := stats[record.ImportBatchID]
		current.UploadSessionCount++
		stats[record.ImportBatchID] = current
	}

	for _, record := range s.ImportBatchItems {
		if _, ok := lookup[record.ImportBatchID]; !ok {
			continue
		}
		current := stats[record.ImportBatchID]
		current.ItemCount++
		if record.Status == "confirmed" {
			current.ConfirmedItemCount++
		}
		stats[record.ImportBatchID] = current
	}

	assetToBatch := make(map[string]string)
	for _, record := range s.MediaAssets {
		if _, ok := lookup[record.ImportBatchID]; !ok {
			continue
		}
		current := stats[record.ImportBatchID]
		current.MediaAssetCount++
		stats[record.ImportBatchID] = current
		assetToBatch[record.ID] = record.ImportBatchID
	}

	for _, record := range s.CandidateAssets {
		importBatchID, ok := assetToBatch[record.AssetID]
		if !ok {
			continue
		}
		current := stats[importBatchID]
		current.CandidateAssetCount++
		stats[importBatchID] = current
	}

	return stats
}

func (s *MemoryStore) SaveImportBatchItem(ctx context.Context, record asset.ImportBatchItem) error {
	return s.save(ctx, func() { s.ImportBatchItems[record.ID] = record })
}

func (s *MemoryStore) GetImportBatchItem(itemID string) (asset.ImportBatchItem, bool) {
	record, ok := s.ImportBatchItems[itemID]
	return record, ok
}

func (s *MemoryStore) ListImportBatchItems(importBatchID string) []asset.ImportBatchItem {
	items := make([]asset.ImportBatchItem, 0)
	for _, record := range s.ImportBatchItems {
		if record.ImportBatchID == importBatchID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveUploadSession(ctx context.Context, record asset.UploadSession) error {
	return s.save(ctx, func() { s.UploadSessions[record.ID] = record })
}

func (s *MemoryStore) GetUploadSession(sessionID string) (asset.UploadSession, bool) {
	record, ok := s.UploadSessions[sessionID]
	return record, ok
}

func (s *MemoryStore) ListUploadSessionsByImportBatch(importBatchID string) []asset.UploadSession {
	items := make([]asset.UploadSession, 0)
	for _, record := range s.UploadSessions {
		if record.ImportBatchID == importBatchID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveUploadFile(ctx context.Context, record asset.UploadFile) error {
	return s.save(ctx, func() { s.UploadFiles[record.ID] = record })
}

func (s *MemoryStore) ListUploadFilesBySessionIDs(sessionIDs []string) []asset.UploadFile {
	lookup := make(map[string]struct{}, len(sessionIDs))
	for _, id := range sessionIDs {
		lookup[id] = struct{}{}
	}
	items := make([]asset.UploadFile, 0)
	for _, record := range s.UploadFiles {
		if _, ok := lookup[record.UploadSessionID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveMediaAsset(ctx context.Context, record asset.MediaAsset) error {
	return s.save(ctx, func() { s.MediaAssets[record.ID] = record })
}

func (s *MemoryStore) GetMediaAsset(assetID string) (asset.MediaAsset, bool) {
	record, ok := s.MediaAssets[assetID]
	return record, ok
}

func (s *MemoryStore) ListMediaAssetsByIDs(assetIDs []string) []asset.MediaAsset {
	lookup := make(map[string]struct{}, len(assetIDs))
	for _, assetID := range assetIDs {
		normalizedID := strings.TrimSpace(assetID)
		if normalizedID == "" {
			continue
		}
		lookup[normalizedID] = struct{}{}
	}
	items := make([]asset.MediaAsset, 0, len(lookup))
	for _, record := range s.MediaAssets {
		if _, ok := lookup[record.ID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) ListMediaAssetsByImportBatch(importBatchID string) []asset.MediaAsset {
	items := make([]asset.MediaAsset, 0)
	for _, record := range s.MediaAssets {
		if record.ImportBatchID == importBatchID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveMediaAssetVariant(ctx context.Context, record asset.MediaAssetVariant) error {
	return s.save(ctx, func() { s.MediaAssetVariants[record.ID] = record })
}

func (s *MemoryStore) ListMediaAssetVariantsByUploadFileIDs(uploadFileIDs []string) []asset.MediaAssetVariant {
	lookup := make(map[string]struct{}, len(uploadFileIDs))
	for _, id := range uploadFileIDs {
		lookup[id] = struct{}{}
	}
	items := make([]asset.MediaAssetVariant, 0)
	for _, record := range s.MediaAssetVariants {
		if _, ok := lookup[record.UploadFileID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) ListMediaAssetVariantsByAssetIDs(assetIDs []string) []asset.MediaAssetVariant {
	lookup := make(map[string]struct{}, len(assetIDs))
	for _, id := range assetIDs {
		lookup[id] = struct{}{}
	}
	items := make([]asset.MediaAssetVariant, 0)
	for _, record := range s.MediaAssetVariants {
		if _, ok := lookup[record.AssetID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveCandidateAsset(ctx context.Context, record asset.CandidateAsset) error {
	return s.save(ctx, func() { s.CandidateAssets[record.ID] = record })
}

func (s *MemoryStore) ListCandidateAssetsByExecution(shotExecutionID string) []asset.CandidateAsset {
	items := make([]asset.CandidateAsset, 0)
	for _, record := range s.CandidateAssets {
		if record.ShotExecutionID == shotExecutionID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) ListCandidateAssetsByAssetIDs(assetIDs []string) []asset.CandidateAsset {
	lookup := make(map[string]struct{}, len(assetIDs))
	for _, id := range assetIDs {
		lookup[id] = struct{}{}
	}
	items := make([]asset.CandidateAsset, 0)
	for _, record := range s.CandidateAssets {
		if _, ok := lookup[record.AssetID]; ok {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveReview(ctx context.Context, record review.ShotReview) error {
	return s.save(ctx, func() { s.Reviews[record.ID] = record })
}

func (s *MemoryStore) ListReviewsByExecution(shotExecutionID string) []review.ShotReview {
	items := make([]review.ShotReview, 0)
	for _, record := range s.Reviews {
		if record.ShotExecutionID == shotExecutionID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveEvaluationRun(ctx context.Context, record review.EvaluationRun) error {
	return s.save(ctx, func() { s.EvaluationRuns[record.ID] = record })
}

func (s *MemoryStore) ListEvaluationRunsByExecution(shotExecutionID string) []review.EvaluationRun {
	items := make([]review.EvaluationRun, 0)
	for _, record := range s.EvaluationRuns {
		if record.ShotExecutionID == shotExecutionID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveBudget(ctx context.Context, record billing.ProjectBudget) error {
	return s.save(ctx, func() { s.Budgets[record.ID] = record })
}

func (s *MemoryStore) GetBudgetByProject(projectID string) (billing.ProjectBudget, bool) {
	for _, record := range s.Budgets {
		if record.ProjectID == projectID {
			return record, true
		}
	}
	return billing.ProjectBudget{}, false
}

func (s *MemoryStore) SaveUsageRecord(ctx context.Context, record billing.UsageRecord) error {
	return s.save(ctx, func() { s.UsageRecords[record.ID] = record })
}

func (s *MemoryStore) ListUsageRecordsByProject(projectID string) []billing.UsageRecord {
	items := make([]billing.UsageRecord, 0)
	for _, record := range s.UsageRecords {
		if record.ProjectID == projectID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) SaveBillingEvent(ctx context.Context, record billing.BillingEvent) error {
	return s.save(ctx, func() { s.BillingEvents[record.ID] = record })
}

func (s *MemoryStore) ListBillingEventsByProject(projectID string) []billing.BillingEvent {
	items := make([]billing.BillingEvent, 0)
	for _, record := range s.BillingEvents {
		if record.ProjectID == projectID {
			items = append(items, record)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *MemoryStore) GetGatewayResult(idempotencyKey string) (gateway.GatewayResult, bool) {
	record, ok := s.GatewayResults[idempotencyKey]
	return record, ok
}

func (s *MemoryStore) SaveGatewayResult(ctx context.Context, idempotencyKey string, result gateway.GatewayResult) error {
	return s.save(ctx, func() { s.GatewayResults[idempotencyKey] = result })
}

func (s *MemoryStore) SaveWorkflowRun(ctx context.Context, record workflow.WorkflowRun) error {
	return s.save(ctx, func() { s.WorkflowRuns[record.ID] = record })
}

func (s *MemoryStore) SaveWorkflowStep(ctx context.Context, record workflow.WorkflowStep) error {
	return s.save(ctx, func() { s.WorkflowSteps[record.ID] = record })
}

func (s *MemoryStore) SaveJob(ctx context.Context, record workflow.Job) error {
	return s.save(ctx, func() { s.Jobs[record.ID] = record })
}

func (s *MemoryStore) SaveStateTransition(ctx context.Context, record workflow.StateTransition) error {
	return s.save(ctx, func() { s.StateTransitions[record.ID] = record })
}

func (s *MemoryStore) GetWorkflowRun(workflowRunID string) (workflow.WorkflowRun, bool) {
	record, ok := s.WorkflowRuns[workflowRunID]
	return record, ok
}

func (s *MemoryStore) GetJob(jobID string) (workflow.Job, bool) {
	record, ok := s.Jobs[jobID]
	return record, ok
}

func (s *MemoryStore) ListWorkflowSteps(workflowRunID string) []workflow.WorkflowStep {
	items := make([]workflow.WorkflowStep, 0)
	for _, record := range s.WorkflowSteps {
		if record.WorkflowRunID != workflowRunID {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].StepOrder != items[j].StepOrder {
			return items[i].StepOrder < items[j].StepOrder
		}
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		}
		return items[i].ID < items[j].ID
	})
	return items
}

func (s *MemoryStore) ListWorkflowRuns(projectID, resourceID, status, workflowType string) []workflow.WorkflowRun {
	items := make([]workflow.WorkflowRun, 0)
	for _, record := range s.WorkflowRuns {
		if projectID != "" && record.ProjectID != projectID {
			continue
		}
		if resourceID != "" && record.ResourceID != resourceID {
			continue
		}
		if status != "" && record.Status != status {
			continue
		}
		if workflowType != "" && record.WorkflowType != workflowType {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if !items[i].UpdatedAt.Equal(items[j].UpdatedAt) {
			return items[i].UpdatedAt.After(items[j].UpdatedAt)
		}
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		}
		return items[i].ID > items[j].ID
	})
	return items
}

func (s *MemoryStore) ListJobs(resourceType, resourceID, jobType, status string) []workflow.Job {
	items := make([]workflow.Job, 0)
	for _, record := range s.Jobs {
		if resourceType != "" && record.ResourceType != resourceType {
			continue
		}
		if resourceID != "" && record.ResourceID != resourceID {
			continue
		}
		if jobType != "" && record.JobType != jobType {
			continue
		}
		if status != "" && record.Status != status {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Priority != items[j].Priority {
			return items[i].Priority > items[j].Priority
		}
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		}
		return items[i].ID < items[j].ID
	})
	return items
}

func (s *MemoryStore) ListStateTransitions(resourceType, resourceID string) []workflow.StateTransition {
	items := make([]workflow.StateTransition, 0)
	for _, record := range s.StateTransitions {
		if resourceType != "" && record.ResourceType != resourceType {
			continue
		}
		if resourceID != "" && record.ResourceID != resourceID {
			continue
		}
		items = append(items, record)
	}
	sort.Slice(items, func(i, j int) bool {
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		}
		return items[i].ID < items[j].ID
	})
	return items
}

func (s *MemoryStore) ClaimNextJob(ctx context.Context, jobType string) (workflow.Job, bool, error) {
	items := s.ListJobs("", "", strings.TrimSpace(jobType), workflow.StatusPending)
	for _, item := range items {
		if !item.ScheduledAt.IsZero() && item.ScheduledAt.After(time.Now().UTC()) {
			continue
		}
		item.Status = workflow.StatusRunning
		item.StartedAt = time.Now().UTC()
		item.UpdatedAt = item.StartedAt
		if err := s.SaveJob(ctx, item); err != nil {
			return workflow.Job{}, false, err
		}
		return item, true, nil
	}
	return workflow.Job{}, false, nil
}
