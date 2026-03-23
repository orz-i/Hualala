package connect

import (
	"time"

	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	authv1 "github.com/hualala/apps/backend/gen/hualala/auth/v1"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	contentv1 "github.com/hualala/apps/backend/gen/hualala/content/v1"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	orgv1 "github.com/hualala/apps/backend/gen/hualala/org/v1"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/auth"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/org"
	"github.com/hualala/apps/backend/internal/domain/project"
	"github.com/hualala/apps/backend/internal/domain/review"
)

func mapSession(record auth.Session) *authv1.Session {
	return &authv1.Session{
		SessionId:       record.SessionID,
		UserId:          record.UserID,
		OrgId:           record.OrgID,
		Locale:          record.Locale,
		RoleId:          record.RoleID,
		RoleCode:        record.RoleCode,
		PermissionCodes: append([]string(nil), record.PermissionCodes...),
		Timezone:        record.Timezone,
	}
}

func mapUserPreferences(record auth.UserPreferences) *authv1.UserPreferences {
	return &authv1.UserPreferences{
		UserId:        record.UserID,
		DisplayLocale: record.DisplayLocale,
		Timezone:      record.Timezone,
	}
}

func mapOrgMember(record org.Member) *orgv1.Member {
	return &orgv1.Member{
		MemberId: record.ID,
		OrgId:    record.OrgID,
		UserId:   record.UserID,
		RoleId:   record.RoleID,
	}
}

func mapOrgRole(record org.Role) *orgv1.Role {
	return &orgv1.Role{
		RoleId:          record.ID,
		OrgId:           record.OrgID,
		Code:            record.Code,
		DisplayName:     record.DisplayName,
		PermissionCodes: append([]string(nil), record.PermissionCodes...),
	}
}

func mapAvailablePermission(record org.AvailablePermission) *orgv1.AvailablePermission {
	return &orgv1.AvailablePermission{
		Code:        record.Code,
		DisplayName: record.DisplayName,
		Group:       record.Group,
	}
}

func mapOrgLocaleSettings(record org.OrgLocaleSettings) *orgv1.OrgLocaleSettings {
	return &orgv1.OrgLocaleSettings{
		OrgId:            record.OrgID,
		DefaultLocale:    record.DefaultLocale,
		SupportedLocales: append([]string(nil), record.SupportedLocales...),
	}
}

func mapProject(record project.Project) *projectv1.Project {
	return &projectv1.Project{
		ProjectId: record.ID,
		OrgId:     record.OrganizationID,
		Title:     record.Title,
		Status:    record.Status,
	}
}

func mapEpisode(record project.Episode) *projectv1.Episode {
	return &projectv1.Episode{
		EpisodeId:     record.ID,
		ProjectId:     record.ProjectID,
		Title:         record.Title,
		EpisodeNumber: uint32(record.EpisodeNo),
	}
}

func mapPreviewAssemblyItem(record project.PreviewAssemblyItem) *projectv1.PreviewAssemblyItem {
	return &projectv1.PreviewAssemblyItem{
		ItemId:         record.ID,
		AssemblyId:     record.AssemblyID,
		ShotId:         record.ShotID,
		PrimaryAssetId: record.PrimaryAssetID,
		SourceRunId:    record.SourceRunID,
		Sequence:       uint32(record.Sequence),
	}
}

func mapPreviewWorkbench(record projectapp.PreviewWorkbench) *projectv1.PreviewAssembly {
	items := make([]*projectv1.PreviewAssemblyItem, 0, len(record.Items))
	for _, item := range record.Items {
		items = append(items, mapPreviewAssemblyItem(item))
	}
	return &projectv1.PreviewAssembly{
		AssemblyId: record.Assembly.ID,
		ProjectId:  record.Assembly.ProjectID,
		EpisodeId:  record.Assembly.EpisodeID,
		Status:     record.Assembly.Status,
		Items:      items,
		CreatedAt:  timestampOrNil(record.Assembly.CreatedAt),
		UpdatedAt:  timestampOrNil(record.Assembly.UpdatedAt),
	}
}

func mapScene(record content.Scene) *contentv1.Scene {
	return &contentv1.Scene{
		Id:           record.ID,
		EpisodeId:    record.EpisodeID,
		Code:         record.Code,
		Title:        record.Title,
		SourceLocale: record.SourceLocale,
	}
}

func mapShot(record content.Shot) *contentv1.Shot {
	return &contentv1.Shot{
		Id:           record.ID,
		SceneId:      record.SceneID,
		Code:         record.Code,
		Title:        record.Title,
		SourceLocale: record.SourceLocale,
	}
}

func mapContentSnapshot(record content.Snapshot) *contentv1.ContentSnapshot {
	return &contentv1.ContentSnapshot{
		Id:                 record.ID,
		OwnerType:          record.OwnerType,
		OwnerId:            record.OwnerID,
		Locale:             record.Locale,
		SourceSnapshotId:   record.SourceSnapshotID,
		TranslationGroupId: record.TranslationGroupID,
		TranslationStatus:  record.TranslationStatus,
		Body:               record.Body,
	}
}

func mapCollaborationPresence(record content.CollaborationPresence) *contentv1.CollaborationPresence {
	return &contentv1.CollaborationPresence{
		PresenceId:     record.ID,
		SessionId:      record.SessionID,
		UserId:         record.UserID,
		Status:         record.Status,
		LastSeenAt:     timestampOrNil(record.LastSeenAt),
		LeaseExpiresAt: timestampOrNil(record.LeaseExpiresAt),
	}
}

func mapCollaborationSession(record contentapp.CollaborationSessionState) *contentv1.CollaborationSession {
	presences := make([]*contentv1.CollaborationPresence, 0, len(record.Presences))
	for _, presence := range record.Presences {
		presences = append(presences, mapCollaborationPresence(presence))
	}
	return &contentv1.CollaborationSession{
		SessionId:        record.Session.ID,
		OwnerType:        record.Session.OwnerType,
		OwnerId:          record.Session.OwnerID,
		DraftVersion:     record.Session.DraftVersion,
		LockHolderUserId: record.Session.LockHolderUserID,
		LeaseExpiresAt:   timestampOrNil(record.Session.LeaseExpiresAt),
		ConflictSummary:  record.Session.ConflictSummary,
		Presences:        presences,
		CreatedAt:        timestampOrNil(record.Session.CreatedAt),
		UpdatedAt:        timestampOrNil(record.Session.UpdatedAt),
	}
}

func mapShotExecution(record execution.ShotExecution) *executionv1.ShotExecution {
	return &executionv1.ShotExecution{
		Id:             record.ID,
		OrgId:          record.OrgID,
		ProjectId:      record.ProjectID,
		ShotId:         record.ShotID,
		Status:         record.Status,
		PrimaryAssetId: record.PrimaryAssetID,
		CurrentRunId:   record.CurrentRunID,
	}
}

func mapShotExecutionRun(record execution.ShotExecutionRun) *executionv1.ShotExecutionRun {
	return &executionv1.ShotExecutionRun{
		Id:              record.ID,
		ShotExecutionId: record.ShotExecutionID,
		RunNumber:       uint32(record.RunNumber),
		Status:          record.Status,
		TriggerType:     record.TriggerType,
		OperatorId:      record.OperatorID,
	}
}

func mapShotWorkbench(record executionapp.ShotWorkbench) *executionv1.ShotWorkbench {
	runs := make([]*executionv1.ShotExecutionRun, 0, len(record.Runs))
	for _, run := range record.Runs {
		runs = append(runs, mapShotExecutionRun(run))
	}
	candidateAssets := make([]*assetv1.ShotCandidateAsset, 0, len(record.CandidateAssets))
	for _, candidate := range record.CandidateAssets {
		candidateAssets = append(candidateAssets, mapCandidateAsset(candidate))
	}
	var latestEvaluationRun *reviewv1.EvaluationRun
	if record.LatestEvaluationRun != nil {
		latestEvaluationRun = mapEvaluationRun(*record.LatestEvaluationRun)
	}
	return &executionv1.ShotWorkbench{
		ShotExecution:       mapShotExecution(record.ShotExecution),
		Runs:                runs,
		CandidateAssets:     candidateAssets,
		ReviewSummary:       mapShotReviewSummary(reviewapp.ShotReviewSummary(record.ReviewSummary)),
		LatestEvaluationRun: latestEvaluationRun,
	}
}

func mapImportBatch(record asset.ImportBatch) *assetv1.ImportBatch {
	return &assetv1.ImportBatch{
		Id:         record.ID,
		OrgId:      record.OrgID,
		ProjectId:  record.ProjectID,
		OperatorId: record.OperatorID,
		SourceType: record.SourceType,
		Status:     record.Status,
	}
}

func mapImportBatchSummary(record assetapp.ImportBatchSummary) *assetv1.ImportBatchSummary {
	return &assetv1.ImportBatchSummary{
		Id:                  record.ImportBatch.ID,
		OrgId:               record.ImportBatch.OrgID,
		ProjectId:           record.ImportBatch.ProjectID,
		OperatorId:          record.ImportBatch.OperatorID,
		SourceType:          record.ImportBatch.SourceType,
		Status:              record.ImportBatch.Status,
		UploadSessionCount:  uint32(record.UploadSessionCount),
		ItemCount:           uint32(record.ItemCount),
		ConfirmedItemCount:  uint32(record.ConfirmedItemCount),
		CandidateAssetCount: uint32(record.CandidateAssetCount),
		MediaAssetCount:     uint32(record.MediaAssetCount),
		UpdatedAt:           record.ImportBatch.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func mapImportBatchItem(record asset.ImportBatchItem) *assetv1.ImportBatchItem {
	return &assetv1.ImportBatchItem{
		Id:            record.ID,
		ImportBatchId: record.ImportBatchID,
		Status:        record.Status,
		MatchedShotId: record.MatchedShotID,
		AssetId:       record.AssetID,
	}
}

func mapMediaAsset(record asset.MediaAsset) *assetv1.MediaAsset {
	return &assetv1.MediaAsset{
		Id:            record.ID,
		ProjectId:     record.ProjectID,
		ImportBatchId: record.ImportBatchID,
		SourceType:    record.SourceType,
		Locale:        record.Locale,
		RightsStatus:  record.RightsStatus,
		AiAnnotated:   record.AIAnnotated,
	}
}

func mapCandidateAsset(record asset.CandidateAsset) *assetv1.ShotCandidateAsset {
	return &assetv1.ShotCandidateAsset{
		Id:              record.ID,
		ShotExecutionId: record.ShotExecutionID,
		AssetId:         record.AssetID,
		SourceRunId:     record.SourceRunID,
	}
}

func mapUploadSession(record asset.UploadSession) *assetv1.UploadSession {
	return &assetv1.UploadSession{
		Id:            record.ID,
		OrgId:         record.OrgID,
		ProjectId:     record.ProjectID,
		ImportBatchId: record.ImportBatchID,
		FileName:      record.FileName,
		Checksum:      record.Checksum,
		SizeBytes:     record.SizeBytes,
		RetryCount:    uint32(record.RetryCount),
		Status:        record.Status,
		ResumeHint:    record.ResumeHint,
	}
}

func mapUploadFile(record asset.UploadFile) *assetv1.UploadFile {
	return &assetv1.UploadFile{
		Id:              record.ID,
		UploadSessionId: record.UploadSessionID,
		FileName:        record.FileName,
		MimeType:        record.MimeType,
		Checksum:        record.Checksum,
		SizeBytes:       record.SizeBytes,
	}
}

func mapMediaAssetVariant(record asset.MediaAssetVariant) *assetv1.MediaAssetVariant {
	return &assetv1.MediaAssetVariant{
		Id:           record.ID,
		AssetId:      record.AssetID,
		UploadFileId: record.UploadFileID,
		VariantType:  record.VariantType,
		MimeType:     record.MimeType,
		Width:        uint32(record.Width),
		Height:       uint32(record.Height),
	}
}

func mapImportBatchShotExecution(record execution.ShotExecution) *assetv1.ImportBatchShotExecution {
	return &assetv1.ImportBatchShotExecution{
		Id:             record.ID,
		ShotId:         record.ShotID,
		Status:         record.Status,
		PrimaryAssetId: record.PrimaryAssetID,
		CurrentRunId:   record.CurrentRunID,
	}
}

func mapShotReview(record review.ShotReview) *reviewv1.ShotReview {
	return &reviewv1.ShotReview{
		Id:              record.ID,
		ShotExecutionId: record.ShotExecutionID,
		Conclusion:      record.Conclusion,
		CommentLocale:   record.CommentLocale,
	}
}

func mapEvaluationRun(record review.EvaluationRun) *reviewv1.EvaluationRun {
	return &reviewv1.EvaluationRun{
		Id:              record.ID,
		ShotExecutionId: record.ShotExecutionID,
		PassedChecks:    record.PassedChecks,
		FailedChecks:    record.FailedChecks,
		Status:          record.Status,
	}
}

func mapShotReviewSummary(record reviewapp.ShotReviewSummary) *reviewv1.ShotReviewSummary {
	return &reviewv1.ShotReviewSummary{
		ShotExecutionId:  record.ShotExecutionID,
		LatestConclusion: record.LatestConclusion,
		LatestReviewId:   record.LatestReviewID,
	}
}

func mapBudgetSnapshot(record billingapp.BudgetSnapshot) *billingv1.BudgetSnapshot {
	return &billingv1.BudgetSnapshot{
		ProjectId:            record.ProjectID,
		LimitCents:           record.LimitCents,
		ReservedCents:        record.ReservedCents,
		RemainingBudgetCents: record.RemainingBudgetCents,
	}
}

func mapUsageRecord(record billing.UsageRecord) *billingv1.UsageRecord {
	return &billingv1.UsageRecord{
		Id:                 record.ID,
		ProjectId:          record.ProjectID,
		ShotExecutionId:    record.ShotExecutionID,
		ShotExecutionRunId: record.ShotExecutionRunID,
		Meter:              record.Meter,
		AmountCents:        record.AmountCents,
	}
}

func mapBillingEvent(record billing.BillingEvent) *billingv1.BillingEvent {
	return &billingv1.BillingEvent{
		Id:                 record.ID,
		EventType:          record.EventType,
		ProjectId:          record.ProjectID,
		ShotExecutionId:    record.ShotExecutionID,
		ShotExecutionRunId: record.ShotExecutionRunID,
		AmountCents:        record.AmountCents,
	}
}

func mapBudgetPolicy(record billing.ProjectBudget) *billingv1.BudgetPolicy {
	return &billingv1.BudgetPolicy{
		Id:            record.ID,
		OrgId:         record.OrgID,
		ProjectId:     record.ProjectID,
		LimitCents:    record.LimitCents,
		ReservedCents: record.ReservedCents,
	}
}
