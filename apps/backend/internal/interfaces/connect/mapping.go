package connect

import (
	assetv1 "github.com/hualala/apps/backend/gen/hualala/asset/v1"
	billingv1 "github.com/hualala/apps/backend/gen/hualala/billing/v1"
	executionv1 "github.com/hualala/apps/backend/gen/hualala/execution/v1"
	reviewv1 "github.com/hualala/apps/backend/gen/hualala/review/v1"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/review"
)

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
	return &executionv1.ShotWorkbench{
		ShotExecution: mapShotExecution(record.ShotExecution),
		Runs:          runs,
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
