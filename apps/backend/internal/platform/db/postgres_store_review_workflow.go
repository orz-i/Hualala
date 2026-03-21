package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/billing"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/review"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/lib/pq"
)

type workflowRunMetadata struct {
	ResourceID        string `json:"resource_id,omitempty"`
	CurrentStep       string `json:"current_step,omitempty"`
	AttemptCount      int    `json:"attempt_count,omitempty"`
	Provider          string `json:"provider,omitempty"`
	ExternalRequestID string `json:"external_request_id,omitempty"`
}

func (s *PostgresStore) SaveReview(ctx context.Context, record review.ShotReview) error {
	scope, ok := s.lookupExecutionScope(ctx, record.ShotExecutionID)
	if !ok {
		return fmt.Errorf("db: shot execution %s not found for review", record.ShotExecutionID)
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shot_reviews (
			id, organization_id, project_id, shot_execution_id, shot_execution_run_id,
			conclusion, comment_locale, comment_body, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    shot_execution_id = EXCLUDED.shot_execution_id,
		    shot_execution_run_id = EXCLUDED.shot_execution_run_id,
		    conclusion = EXCLUDED.conclusion,
		    comment_locale = EXCLUDED.comment_locale,
		    comment_body = EXCLUDED.comment_body,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, scope.OrgID, scope.ProjectID, record.ShotExecutionID, nullableUUID(scope.CurrentRunID), defaultString(record.Conclusion, "commented"), defaultString(record.CommentLocale, "zh-CN"), emptyToNil(record.Comment), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert shot review %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListReviewsByExecution(shotExecutionID string) []review.ShotReview {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, conclusion, comment_locale, COALESCE(comment_body, ''), created_at, updated_at
		FROM shot_reviews
		WHERE shot_execution_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(shotExecutionID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]review.ShotReview, 0)
	for rows.Next() {
		var record review.ShotReview
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.Conclusion, &record.CommentLocale, &record.Comment, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveEvaluationRun(ctx context.Context, record review.EvaluationRun) error {
	scope, ok := s.lookupExecutionScope(ctx, record.ShotExecutionID)
	if !ok {
		return fmt.Errorf("db: shot execution %s not found for evaluation run", record.ShotExecutionID)
	}
	failedChecks := append([]string(nil), record.FailedChecks...)
	if failedChecks == nil {
		failedChecks = []string{}
	}
	summary, err := jsonString(evaluationSummaryPayload{
		PassedChecks: record.PassedChecks,
		FailedChecks: failedChecks,
	})
	if err != nil {
		return fmt.Errorf("db: encode evaluation run %s: %w", record.ID, err)
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO evaluation_runs (
			id, organization_id, project_id, shot_execution_id, shot_execution_run_id,
			evaluation_type, status, result_summary, failure_codes, started_at, completed_at,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'submission_gate', $6, $7::jsonb, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    shot_execution_id = EXCLUDED.shot_execution_id,
		    shot_execution_run_id = EXCLUDED.shot_execution_run_id,
		    status = EXCLUDED.status,
		    result_summary = EXCLUDED.result_summary,
		    failure_codes = EXCLUDED.failure_codes,
		    started_at = EXCLUDED.started_at,
		    completed_at = EXCLUDED.completed_at,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, scope.OrgID, scope.ProjectID, record.ShotExecutionID, nullableUUID(scope.CurrentRunID), defaultString(record.Status, "passed"), summary, pq.Array(failedChecks), record.CreatedAt, record.CreatedAt, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert evaluation run %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListEvaluationRunsByExecution(shotExecutionID string) []review.EvaluationRun {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, shot_execution_id::text, status, result_summary::text, created_at, updated_at
		FROM evaluation_runs
		WHERE shot_execution_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(shotExecutionID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]review.EvaluationRun, 0)
	for rows.Next() {
		var (
			record      review.EvaluationRun
			summaryText string
		)
		if err := rows.Scan(&record.ID, &record.ShotExecutionID, &record.Status, &summaryText, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		var payload evaluationSummaryPayload
		if summaryText != "" {
			_ = json.Unmarshal([]byte(summaryText), &payload)
		}
		record.PassedChecks = append([]string(nil), payload.PassedChecks...)
		record.FailedChecks = append([]string(nil), payload.FailedChecks...)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveBudget(ctx context.Context, record billing.ProjectBudget) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO budget_policies (
			id, organization_id, project_id, policy_name, policy_mode, currency_code,
			max_budget_units, status, created_at, updated_at
		) VALUES ($1, $2, $3, 'default', 'hard_stop', 'CNY', $4, 'active', $5, $6)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    max_budget_units = EXCLUDED.max_budget_units,
		    updated_at = EXCLUDED.updated_at,
		    archived_at = NULL
	`, record.ID, record.OrgID, record.ProjectID, record.LimitCents, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert budget %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetBudgetByProject(projectID string) (billing.ProjectBudget, bool) {
	if s == nil || s.db == nil {
		return billing.ProjectBudget{}, false
	}
	record := billing.ProjectBudget{}
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, max_budget_units, created_at, updated_at
		FROM budget_policies
		WHERE project_id = $1 AND archived_at IS NULL
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, strings.TrimSpace(projectID)).Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.LimitCents, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return billing.ProjectBudget{}, false
	}
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	if err := s.db.QueryRowContext(context.Background(), `
		SELECT COALESCE(SUM(total_cost_units), 0)
		FROM usage_records
		WHERE project_id = $1
	`, strings.TrimSpace(projectID)).Scan(&record.ReservedCents); err != nil {
		return billing.ProjectBudget{}, false
	}
	return record, true
}

func (s *PostgresStore) SaveUsageRecord(ctx context.Context, record billing.UsageRecord) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO usage_records (
			id, organization_id, project_id, shot_execution_run_id, usage_type,
			total_cost_units, currency_code, recorded_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'CNY', $7, $8)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    shot_execution_run_id = EXCLUDED.shot_execution_run_id,
		    usage_type = EXCLUDED.usage_type,
		    total_cost_units = EXCLUDED.total_cost_units,
		    recorded_at = EXCLUDED.recorded_at
	`, record.ID, record.OrgID, record.ProjectID, nullableUUID(record.ShotExecutionRunID), defaultString(record.Meter, "shot_execution_run"), record.AmountCents, record.CreatedAt, record.CreatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert usage record %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListUsageRecordsByProject(projectID string) []billing.UsageRecord {
	if s == nil || s.db == nil {
		return nil
	}
	runExecutionMap := s.listRunExecutionMap(projectID)
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, COALESCE(shot_execution_run_id::text, ''),
		       usage_type, total_cost_units, created_at
		FROM usage_records
		WHERE project_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(projectID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]billing.UsageRecord, 0)
	for rows.Next() {
		var record billing.UsageRecord
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.ShotExecutionRunID, &record.Meter, &record.AmountCents, &record.CreatedAt); err != nil {
			return nil
		}
		record.ShotExecutionID = runExecutionMap[record.ShotExecutionRunID]
		record.CreatedAt = record.CreatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveBillingEvent(ctx context.Context, record billing.BillingEvent) error {
	payload, err := jsonString(map[string]any{
		"amount_cents":          record.AmountCents,
		"shot_execution_id":     record.ShotExecutionID,
		"shot_execution_run_id": record.ShotExecutionRunID,
	})
	if err != nil {
		return fmt.Errorf("db: encode billing event %s: %w", record.ID, err)
	}
	budgetID := ""
	if budget, ok := s.GetBudgetByProject(record.ProjectID); ok {
		budgetID = budget.ID
	}
	usageID := s.lookupUsageRecordIDByRun(ctx, record.ShotExecutionRunID)
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO billing_events (
			id, organization_id, project_id, usage_record_id, budget_policy_id,
			event_type, severity, message_key, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'info', $7, $8::jsonb, $9)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    usage_record_id = EXCLUDED.usage_record_id,
		    budget_policy_id = EXCLUDED.budget_policy_id,
		    event_type = EXCLUDED.event_type,
		    message_key = EXCLUDED.message_key,
		    payload = EXCLUDED.payload,
		    created_at = EXCLUDED.created_at
	`, record.ID, record.OrgID, record.ProjectID, nullableUUID(usageID), nullableUUID(budgetID), defaultString(record.EventType, "info"), defaultString(record.EventType, "info"), payload, record.CreatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert billing event %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) ListBillingEventsByProject(projectID string) []billing.BillingEvent {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, event_type, payload::text, created_at
		FROM billing_events
		WHERE project_id = $1
		ORDER BY id ASC
	`, strings.TrimSpace(projectID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]billing.BillingEvent, 0)
	for rows.Next() {
		var (
			record      billing.BillingEvent
			payloadText string
		)
		if err := rows.Scan(&record.ID, &record.OrgID, &record.ProjectID, &record.EventType, &payloadText, &record.CreatedAt); err != nil {
			return nil
		}
		payload := map[string]any{}
		if payloadText != "" {
			_ = json.Unmarshal([]byte(payloadText), &payload)
		}
		record.ShotExecutionID = stringFromPayload(payload, "shot_execution_id")
		record.ShotExecutionRunID = stringFromPayload(payload, "shot_execution_run_id")
		record.AmountCents = int64FromPayload(payload, "amount_cents")
		record.CreatedAt = record.CreatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) SaveWorkflowRun(ctx context.Context, record workflow.WorkflowRun) error {
	metadata, err := jsonString(workflowRunMetadata{
		ResourceID:        record.ResourceID,
		CurrentStep:       record.CurrentStep,
		AttemptCount:      record.AttemptCount,
		Provider:          record.Provider,
		ExternalRequestID: record.ExternalRequestID,
	})
	if err != nil {
		return fmt.Errorf("db: encode workflow run %s metadata: %w", record.ID, err)
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO workflow_runs (
			id, organization_id, project_id, workflow_type, status, trigger_source,
			idempotency_key, failure_reason, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7, $8::jsonb, $9, $10)
		ON CONFLICT (id) DO UPDATE
		SET organization_id = EXCLUDED.organization_id,
		    project_id = EXCLUDED.project_id,
		    workflow_type = EXCLUDED.workflow_type,
		    status = EXCLUDED.status,
		    idempotency_key = EXCLUDED.idempotency_key,
		    failure_reason = EXCLUDED.failure_reason,
		    metadata = EXCLUDED.metadata,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.OrgID, nullableUUID(record.ProjectID), record.WorkflowType, defaultString(record.Status, workflow.StatusPending), emptyToNil(record.IdempotencyKey), emptyToNil(record.LastError), metadata, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert workflow run %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) SaveWorkflowStep(ctx context.Context, record workflow.WorkflowStep) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO workflow_steps (
			id, workflow_run_id, step_key, step_order, status,
			started_at, completed_at, failed_at, error_code, error_message, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11, $12)
		ON CONFLICT (id) DO UPDATE
		SET workflow_run_id = EXCLUDED.workflow_run_id,
		    step_key = EXCLUDED.step_key,
		    step_order = EXCLUDED.step_order,
		    status = EXCLUDED.status,
		    started_at = EXCLUDED.started_at,
		    completed_at = EXCLUDED.completed_at,
		    failed_at = EXCLUDED.failed_at,
		    error_code = EXCLUDED.error_code,
		    error_message = EXCLUDED.error_message,
		    updated_at = EXCLUDED.updated_at
	`, record.ID, record.WorkflowRunID, record.StepKey, record.StepOrder, defaultString(record.Status, workflow.StatusPending), nullableTime(record.StartedAt), nullableTime(record.CompletedAt), nullableTime(record.FailedAt), emptyToNil(record.ErrorCode), emptyToNil(record.ErrorMessage), record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return fmt.Errorf("db: upsert workflow step %s: %w", record.ID, err)
	}
	return nil
}

func (s *PostgresStore) GetWorkflowRun(workflowRunID string) (workflow.WorkflowRun, bool) {
	if s == nil || s.db == nil {
		return workflow.WorkflowRun{}, false
	}
	var (
		record       workflow.WorkflowRun
		projectID    sql.NullString
		idempotency  sql.NullString
		failure      sql.NullString
		metadataText string
	)
	err := s.db.QueryRowContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, workflow_type, status,
		       COALESCE(idempotency_key, ''), COALESCE(failure_reason, ''), metadata::text, created_at, updated_at
		FROM workflow_runs
		WHERE id = $1
	`, strings.TrimSpace(workflowRunID)).Scan(&record.ID, &record.OrgID, &projectID, &record.WorkflowType, &record.Status, &idempotency, &failure, &metadataText, &record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return workflow.WorkflowRun{}, false
	}
	record.ProjectID = nullStringValue(projectID)
	record.IdempotencyKey = nullStringValue(idempotency)
	record.LastError = nullStringValue(failure)
	record.CreatedAt = record.CreatedAt.UTC()
	record.UpdatedAt = record.UpdatedAt.UTC()
	applyWorkflowRunMetadata(&record, metadataText)
	return record, true
}

func (s *PostgresStore) ListWorkflowSteps(workflowRunID string) []workflow.WorkflowStep {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, workflow_run_id::text, step_key, step_order, status,
		       COALESCE(error_code, ''), COALESCE(error_message, ''), started_at, completed_at, failed_at, created_at, updated_at
		FROM workflow_steps
		WHERE workflow_run_id = $1
		ORDER BY step_order ASC, created_at ASC, id ASC
	`, strings.TrimSpace(workflowRunID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]workflow.WorkflowStep, 0)
	for rows.Next() {
		var (
			record                           workflow.WorkflowStep
			startedAt, completedAt, failedAt sql.NullTime
		)
		if err := rows.Scan(&record.ID, &record.WorkflowRunID, &record.StepKey, &record.StepOrder, &record.Status, &record.ErrorCode, &record.ErrorMessage, &startedAt, &completedAt, &failedAt, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.StartedAt = nullTimeValue(startedAt)
		record.CompletedAt = nullTimeValue(completedAt)
		record.FailedAt = nullTimeValue(failedAt)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		items = append(items, record)
	}
	return items
}

func (s *PostgresStore) ListWorkflowRuns(projectID, resourceID, status, workflowType string) []workflow.WorkflowRun {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT id::text, organization_id::text, project_id::text, workflow_type, status,
		       COALESCE(idempotency_key, ''), COALESCE(failure_reason, ''), metadata::text, created_at, updated_at
		FROM workflow_runs
		WHERE ($1 = '' OR project_id::text = $1)
		  AND ($2 = '' OR metadata ->> 'resource_id' = $2)
		  AND ($3 = '' OR status = $3)
		  AND ($4 = '' OR workflow_type = $4)
		ORDER BY updated_at DESC, created_at DESC, id DESC
	`, strings.TrimSpace(projectID), strings.TrimSpace(resourceID), strings.TrimSpace(status), strings.TrimSpace(workflowType))
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := make([]workflow.WorkflowRun, 0)
	for rows.Next() {
		var (
			record       workflow.WorkflowRun
			projectValue sql.NullString
			idempotency  sql.NullString
			failure      sql.NullString
			metadataText string
		)
		if err := rows.Scan(&record.ID, &record.OrgID, &projectValue, &record.WorkflowType, &record.Status, &idempotency, &failure, &metadataText, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil
		}
		record.ProjectID = nullStringValue(projectValue)
		record.IdempotencyKey = nullStringValue(idempotency)
		record.LastError = nullStringValue(failure)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		applyWorkflowRunMetadata(&record, metadataText)
		items = append(items, record)
	}
	return items
}

func applyWorkflowRunMetadata(record *workflow.WorkflowRun, metadataText string) {
	if record == nil || strings.TrimSpace(metadataText) == "" {
		return
	}
	var payload workflowRunMetadata
	if err := json.Unmarshal([]byte(metadataText), &payload); err != nil {
		return
	}
	record.ResourceID = payload.ResourceID
	record.CurrentStep = payload.CurrentStep
	record.AttemptCount = payload.AttemptCount
	record.Provider = payload.Provider
	record.ExternalRequestID = payload.ExternalRequestID
}

func (s *PostgresStore) lookupExecutionScope(ctx context.Context, shotExecutionID string) (execution.ShotExecution, bool) {
	record, ok := s.GetShotExecution(shotExecutionID)
	return record, ok
}

func (s *PostgresStore) lookupUsageRecordIDByRun(ctx context.Context, shotExecutionRunID string) string {
	if strings.TrimSpace(shotExecutionRunID) == "" {
		return ""
	}
	var usageID string
	err := s.db.QueryRowContext(ctx, `
		SELECT id::text
		FROM usage_records
		WHERE shot_execution_run_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, strings.TrimSpace(shotExecutionRunID)).Scan(&usageID)
	if err != nil {
		return ""
	}
	return usageID
}

func (s *PostgresStore) listRunExecutionMap(projectID string) map[string]string {
	if s == nil || s.db == nil {
		return nil
	}
	rows, err := s.db.QueryContext(context.Background(), `
		SELECT shot_execution_runs.id::text, shot_execution_runs.shot_execution_id::text
		FROM shot_execution_runs
		JOIN shot_executions ON shot_executions.id = shot_execution_runs.shot_execution_id
		WHERE shot_executions.project_id = $1
	`, strings.TrimSpace(projectID))
	if err != nil {
		return nil
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var runID string
		var executionID string
		if err := rows.Scan(&runID, &executionID); err != nil {
			return nil
		}
		result[runID] = executionID
	}
	return result
}
