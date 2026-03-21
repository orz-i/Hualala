package db

import (
	"context"
	"sort"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/gateway"
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
	PolicyReader
	GatewayResultStore
	WorkflowRepository
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
	ListScenes(projectID string, episodeID string) []content.Scene

	GenerateShotID() string
	SaveShot(ctx context.Context, record content.Shot) error
	GetShot(shotID string) (content.Shot, bool)
	ListShotsByScene(sceneID string) []content.Shot

	GenerateSnapshotID() string
	GenerateTranslationGroupID() string
	SaveSnapshot(ctx context.Context, record content.Snapshot) error
	GetSnapshot(snapshotID string) (content.Snapshot, bool)
	ListSnapshotsByOwner(ownerType string, ownerID string) []content.Snapshot
}

type ExecutionRepository interface {
	GenerateShotExecutionID() string
	SaveShotExecution(ctx context.Context, record execution.ShotExecution) error
	GetShotExecution(shotExecutionID string) (execution.ShotExecution, bool)
	FindShotExecutionByShotID(shotID string) (execution.ShotExecution, bool)
	ListShotExecutionsByIDs(ids []string) []execution.ShotExecution

	GenerateShotExecutionRunID() string
	SaveShotExecutionRun(ctx context.Context, record execution.ShotExecutionRun) error
	ListShotExecutionRuns(shotExecutionID string) []execution.ShotExecutionRun
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
	SaveWorkflowRun(ctx context.Context, record workflow.WorkflowRun) error
	SaveWorkflowStep(ctx context.Context, record workflow.WorkflowStep) error
	GetWorkflowRun(workflowRunID string) (workflow.WorkflowRun, bool)
	ListWorkflowSteps(workflowRunID string) []workflow.WorkflowStep
	ListWorkflowRuns(projectID, resourceID, status, workflowType string) []workflow.WorkflowRun
}

func (s *MemoryStore) save(ctx context.Context, mutate func()) error {
	if s == nil {
		return nil
	}
	mutate()
	return s.Persist(ctx)
}

func (s *MemoryStore) GenerateProjectID() string           { return s.NextProjectID() }
func (s *MemoryStore) GenerateEpisodeID() string           { return s.NextEpisodeID() }
func (s *MemoryStore) GenerateSceneID() string             { return s.NextSceneID() }
func (s *MemoryStore) GenerateShotID() string              { return s.NextShotID() }
func (s *MemoryStore) GenerateSnapshotID() string          { return s.NextSnapshotID() }
func (s *MemoryStore) GenerateTranslationGroupID() string  { return s.NextTranslationGroupID() }
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

func (s *MemoryStore) GetWorkflowRun(workflowRunID string) (workflow.WorkflowRun, bool) {
	record, ok := s.WorkflowRuns[workflowRunID]
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
