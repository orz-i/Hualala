package connect

import (
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/review"
)

func mapShotExecution(record execution.ShotExecution) map[string]any {
	return map[string]any{
		"id":               record.ID,
		"org_id":           record.OrgID,
		"project_id":       record.ProjectID,
		"shot_id":          record.ShotID,
		"status":           record.Status,
		"primary_asset_id": record.PrimaryAssetID,
		"current_run_id":   record.CurrentRunID,
	}
}

func mapShotExecutionRun(record execution.ShotExecutionRun) map[string]any {
	return map[string]any{
		"id":                record.ID,
		"shot_execution_id": record.ShotExecutionID,
		"run_number":        record.RunNumber,
		"status":            record.Status,
		"trigger_type":      record.TriggerType,
		"operator_id":       record.OperatorID,
	}
}

func mapExecutionWorkbench(record executionapp.ShotWorkbench) map[string]any {
	runs := make([]map[string]any, 0, len(record.Runs))
	for _, run := range record.Runs {
		runs = append(runs, mapShotExecutionRun(run))
	}
	return map[string]any{
		"shot_execution": mapShotExecution(record.ShotExecution),
		"runs":           runs,
	}
}

func mapImportBatch(record asset.ImportBatch) map[string]any {
	return map[string]any{
		"id":          record.ID,
		"org_id":      record.OrgID,
		"project_id":  record.ProjectID,
		"operator_id": record.OperatorID,
		"source_type": record.SourceType,
		"status":      record.Status,
	}
}

func mapMediaAsset(record asset.MediaAsset) map[string]any {
	return map[string]any{
		"id":              record.ID,
		"org_id":          record.OrgID,
		"project_id":      record.ProjectID,
		"import_batch_id": record.ImportBatchID,
		"source_type":     record.SourceType,
		"locale":          record.Locale,
		"rights_status":   record.RightsStatus,
		"ai_annotated":    record.AIAnnotated,
	}
}

func mapCandidateAsset(record asset.CandidateAsset) map[string]any {
	return map[string]any{
		"id":                record.ID,
		"shot_execution_id": record.ShotExecutionID,
		"asset_id":          record.AssetID,
		"source_run_id":     record.SourceRunID,
	}
}

func mapShotReview(record review.ShotReview) map[string]any {
	return map[string]any{
		"id":                record.ID,
		"shot_execution_id": record.ShotExecutionID,
		"conclusion":        record.Conclusion,
		"comment_locale":    record.CommentLocale,
		"comment":           record.Comment,
	}
}

func mapEvaluationRun(record review.EvaluationRun) map[string]any {
	return map[string]any{
		"id":                record.ID,
		"shot_execution_id": record.ShotExecutionID,
		"passed_checks":     record.PassedChecks,
		"failed_checks":     record.FailedChecks,
		"status":            record.Status,
	}
}
