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

func mapPreviewShotSummary(record projectapp.PreviewShotSummary) *projectv1.PreviewShotSummary {
	return &projectv1.PreviewShotSummary{
		ProjectId:    record.ProjectID,
		ProjectTitle: record.ProjectTitle,
		EpisodeId:    record.EpisodeID,
		EpisodeTitle: record.EpisodeTitle,
		SceneId:      record.SceneID,
		SceneCode:    record.SceneCode,
		SceneTitle:   record.SceneTitle,
		ShotId:       record.ShotID,
		ShotCode:     record.ShotCode,
		ShotTitle:    record.ShotTitle,
	}
}

func mapPreviewAssetSummary(record *projectapp.PreviewAssetSummary) *projectv1.PreviewAssetSummary {
	if record == nil {
		return nil
	}
	return &projectv1.PreviewAssetSummary{
		AssetId:      record.AssetID,
		MediaType:    record.MediaType,
		RightsStatus: record.RightsStatus,
		AiAnnotated:  record.AIAnnotated,
	}
}

func mapPreviewRunSummary(record *projectapp.PreviewRunSummary) *projectv1.PreviewRunSummary {
	if record == nil {
		return nil
	}
	return &projectv1.PreviewRunSummary{
		RunId:       record.RunID,
		Status:      record.Status,
		TriggerType: record.TriggerType,
	}
}

func mapPreviewAssemblyItem(record projectapp.PreviewAssemblyItemState) *projectv1.PreviewAssemblyItem {
	return &projectv1.PreviewAssemblyItem{
		ItemId:         record.ID,
		AssemblyId:     record.AssemblyID,
		ShotId:         record.ShotID,
		PrimaryAssetId: record.PrimaryAssetID,
		SourceRunId:    record.SourceRunID,
		Sequence:       uint32(record.Sequence),
		Shot:           mapPreviewShotSummary(record.Shot),
		PrimaryAsset:   mapPreviewAssetSummary(record.PrimaryAsset),
		SourceRun:      mapPreviewRunSummary(record.SourceRun),
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

func mapPreviewShotOption(record projectapp.PreviewShotOption) *projectv1.PreviewShotOption {
	return &projectv1.PreviewShotOption{
		Shot:                mapPreviewShotSummary(record.Shot),
		ShotExecutionId:     record.ShotExecutionID,
		ShotExecutionStatus: record.ShotExecutionStatus,
		CurrentPrimaryAsset: mapPreviewAssetSummary(record.CurrentPrimaryAsset),
		LatestRun:           mapPreviewRunSummary(record.LatestRun),
	}
}

func mapPreviewRuntime(record projectapp.PreviewRuntimeState) *projectv1.PreviewRuntime {
	return &projectv1.PreviewRuntime{
		PreviewRuntimeId:    record.Runtime.ID,
		ProjectId:           record.Runtime.ProjectID,
		EpisodeId:           record.Runtime.EpisodeID,
		AssemblyId:          record.Runtime.AssemblyID,
		Status:              record.Runtime.Status,
		RenderWorkflowRunId: record.Runtime.RenderWorkflowRunID,
		RenderStatus:        record.Runtime.RenderStatus,
		PlaybackAssetId:     record.Runtime.PlaybackAssetID,
		ExportAssetId:       record.Runtime.ExportAssetID,
		ResolvedLocale:      record.Runtime.ResolvedLocale,
		Playback:            mapPreviewPlaybackDelivery(record.Runtime.Playback),
		ExportOutput:        mapPreviewExportDelivery(record.Runtime.ExportOutput),
		LastErrorCode:       record.Runtime.LastErrorCode,
		LastErrorMessage:    record.Runtime.LastErrorMessage,
		CreatedAt:           timestampOrNil(record.Runtime.CreatedAt),
		UpdatedAt:           timestampOrNil(record.Runtime.UpdatedAt),
	}
}

func mapPreviewPlaybackDelivery(record project.PreviewPlaybackDelivery) *projectv1.PreviewPlaybackDelivery {
	if record.DeliveryMode == "" &&
		record.PlaybackURL == "" &&
		record.PosterURL == "" &&
		record.DurationMs == 0 &&
		len(record.Timeline.Segments) == 0 &&
		record.Timeline.TotalDurationMs == 0 {
		return nil
	}
	return &projectv1.PreviewPlaybackDelivery{
		DeliveryMode: record.DeliveryMode,
		PlaybackUrl:  record.PlaybackURL,
		PosterUrl:    record.PosterURL,
		DurationMs:   uint32(record.DurationMs),
		Timeline:     mapPreviewTimelineSpine(record.Timeline),
	}
}

func mapPreviewTimelineSpine(record project.PreviewTimelineSpine) *projectv1.PreviewTimelineSpine {
	if len(record.Segments) == 0 && record.TotalDurationMs == 0 {
		return nil
	}
	segments := make([]*projectv1.PreviewTimelineSegment, 0, len(record.Segments))
	for _, segment := range record.Segments {
		segments = append(segments, mapPreviewTimelineSegment(segment))
	}
	return &projectv1.PreviewTimelineSpine{
		Segments:        segments,
		TotalDurationMs: uint32(record.TotalDurationMs),
	}
}

func mapPreviewTimelineSegment(record project.PreviewTimelineSegment) *projectv1.PreviewTimelineSegment {
	return &projectv1.PreviewTimelineSegment{
		SegmentId:        record.SegmentID,
		Sequence:         uint32(record.Sequence),
		ShotId:           record.ShotID,
		ShotCode:         record.ShotCode,
		ShotTitle:        record.ShotTitle,
		PlaybackAssetId:  record.PlaybackAssetID,
		SourceRunId:      record.SourceRunID,
		StartMs:          uint32(record.StartMs),
		DurationMs:       uint32(record.DurationMs),
		TransitionToNext: mapPreviewTransition(record.TransitionToNext),
	}
}

func mapPreviewTransition(record *project.PreviewTransition) *projectv1.PreviewTransition {
	if record == nil {
		return nil
	}
	return &projectv1.PreviewTransition{
		TransitionType: record.TransitionType,
		DurationMs:     uint32(record.DurationMs),
	}
}

func mapPreviewExportDelivery(record project.PreviewExportDelivery) *projectv1.PreviewExportDelivery {
	if record == (project.PreviewExportDelivery{}) {
		return nil
	}
	return &projectv1.PreviewExportDelivery{
		DownloadUrl: record.DownloadURL,
		MimeType:    record.MimeType,
		FileName:    record.FileName,
		SizeBytes:   record.SizeBytes,
	}
}

func mapAudioClip(record project.AudioClip) *projectv1.AudioClip {
	return &projectv1.AudioClip{
		ClipId:      record.ID,
		TrackId:     record.TrackID,
		AssetId:     record.AssetID,
		SourceRunId: record.SourceRunID,
		Sequence:    uint32(record.Sequence),
		StartMs:     uint32(record.StartMs),
		DurationMs:  uint32(record.DurationMs),
		TrimInMs:    uint32(record.TrimInMs),
		TrimOutMs:   uint32(record.TrimOutMs),
	}
}

func mapAudioTrack(record project.AudioTrack) *projectv1.AudioTrack {
	clips := make([]*projectv1.AudioClip, 0, len(record.Clips))
	for _, clip := range record.Clips {
		clips = append(clips, mapAudioClip(clip))
	}
	return &projectv1.AudioTrack{
		TrackId:       record.ID,
		TimelineId:    record.TimelineID,
		TrackType:     record.TrackType,
		DisplayName:   record.DisplayName,
		Sequence:      uint32(record.Sequence),
		Muted:         record.Muted,
		Solo:          record.Solo,
		VolumePercent: uint32(record.VolumePercent),
		Clips:         clips,
	}
}

func mapAudioWorkbench(record projectapp.AudioWorkbench) *projectv1.AudioTimeline {
	tracks := make([]*projectv1.AudioTrack, 0, len(record.Tracks))
	for _, track := range record.Tracks {
		tracks = append(tracks, mapAudioTrack(track))
	}
	return &projectv1.AudioTimeline{
		AudioTimelineId:     record.Timeline.ID,
		ProjectId:           record.Timeline.ProjectID,
		EpisodeId:           record.Timeline.EpisodeID,
		Status:              record.Timeline.Status,
		RenderWorkflowRunId: record.Timeline.RenderWorkflowRunID,
		RenderStatus:        record.Timeline.RenderStatus,
		Tracks:              tracks,
		CreatedAt:           timestampOrNil(record.Timeline.CreatedAt),
		UpdatedAt:           timestampOrNil(record.Timeline.UpdatedAt),
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
		SnapshotKind:       record.SnapshotKind,
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
		MediaType:     record.MediaType,
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
		DurationMs:   uint32(record.DurationMS),
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
