package db

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/workflow"
)

func (p *PostgresPersister) loadWorkflowRuntime(ctx context.Context, snapshot *Snapshot) error {
	runRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, workflow_type, status,
		       COALESCE(idempotency_key, ''), COALESCE(failure_reason, ''), metadata::text, created_at, updated_at
		FROM workflow_runs
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("db: load workflow runs: %w", err)
	}
	defer runRows.Close()
	for runRows.Next() {
		var (
			record       workflow.WorkflowRun
			projectID    sql.NullString
			idempotency  sql.NullString
			failure      sql.NullString
			metadataText string
		)
		if err := runRows.Scan(&record.ID, &record.OrgID, &projectID, &record.WorkflowType, &record.Status, &idempotency, &failure, &metadataText, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan workflow run: %w", err)
		}
		record.ProjectID = nullStringValue(projectID)
		record.IdempotencyKey = nullStringValue(idempotency)
		record.LastError = nullStringValue(failure)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		applyWorkflowRunMetadata(&record, metadataText)
		snapshot.WorkflowRuns[record.ID] = record
	}
	if err := runRows.Err(); err != nil {
		return fmt.Errorf("db: iterate workflow runs: %w", err)
	}

	stepRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, workflow_run_id::text, step_key, step_order, status,
		       COALESCE(error_code, ''), COALESCE(error_message, ''),
		       started_at, completed_at, failed_at, created_at, updated_at
		FROM workflow_steps
		ORDER BY workflow_run_id ASC, step_order ASC, created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("db: load workflow steps: %w", err)
	}
	defer stepRows.Close()
	for stepRows.Next() {
		var (
			record                           workflow.WorkflowStep
			startedAt, completedAt, failedAt sql.NullTime
		)
		if err := stepRows.Scan(&record.ID, &record.WorkflowRunID, &record.StepKey, &record.StepOrder, &record.Status, &record.ErrorCode, &record.ErrorMessage, &startedAt, &completedAt, &failedAt, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan workflow step: %w", err)
		}
		record.StartedAt = nullTimeValue(startedAt)
		record.CompletedAt = nullTimeValue(completedAt)
		record.FailedAt = nullTimeValue(failedAt)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.WorkflowSteps[record.ID] = record
	}
	if err := stepRows.Err(); err != nil {
		return fmt.Errorf("db: iterate workflow steps: %w", err)
	}

	jobRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, resource_type, COALESCE(resource_id::text, ''),
		       job_type, status, priority, payload::text, scheduled_at, started_at, completed_at, failed_at,
		       COALESCE(error_code, ''), COALESCE(error_message, ''), created_at, updated_at
		FROM jobs
		ORDER BY priority DESC, created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("db: load jobs: %w", err)
	}
	defer jobRows.Close()
	for jobRows.Next() {
		var (
			record                 workflow.Job
			projectID, payload     sql.NullString
			resourceValue          sql.NullString
			scheduledAt, startedAt sql.NullTime
			completedAt, failedAt  sql.NullTime
		)
		if err := jobRows.Scan(&record.ID, &record.OrgID, &projectID, &record.ResourceType, &resourceValue, &record.JobType, &record.Status, &record.Priority, &payload, &scheduledAt, &startedAt, &completedAt, &failedAt, &record.ErrorCode, &record.ErrorMessage, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return fmt.Errorf("db: scan job: %w", err)
		}
		record.ProjectID = nullStringValue(projectID)
		record.ResourceID = nullStringValue(resourceValue)
		record.Payload = nullStringValue(payload)
		record.ScheduledAt = nullTimeValue(scheduledAt)
		record.StartedAt = nullTimeValue(startedAt)
		record.CompletedAt = nullTimeValue(completedAt)
		record.FailedAt = nullTimeValue(failedAt)
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		snapshot.Jobs[record.ID] = record
	}
	if err := jobRows.Err(); err != nil {
		return fmt.Errorf("db: iterate jobs: %w", err)
	}

	transitionRows, err := p.db.QueryContext(ctx, `
		SELECT id::text, organization_id::text, project_id::text, resource_type, resource_id::text,
		       COALESCE(from_state, ''), to_state, COALESCE(transition_reason, ''), created_at
		FROM state_transitions
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("db: load state transitions: %w", err)
	}
	defer transitionRows.Close()
	for transitionRows.Next() {
		var (
			record    workflow.StateTransition
			projectID sql.NullString
		)
		if err := transitionRows.Scan(&record.ID, &record.OrgID, &projectID, &record.ResourceType, &record.ResourceID, &record.FromState, &record.ToState, &record.Reason, &record.CreatedAt); err != nil {
			return fmt.Errorf("db: scan state transition: %w", err)
		}
		record.ProjectID = nullStringValue(projectID)
		record.CreatedAt = record.CreatedAt.UTC()
		snapshot.StateTransitions[record.ID] = record
	}
	if err := transitionRows.Err(); err != nil {
		return fmt.Errorf("db: iterate state transitions: %w", err)
	}

	updateCounter(&snapshot.NextWorkflowRunID, "workflow-run-", snapshot.WorkflowRuns)
	updateCounter(&snapshot.NextWorkflowStepID, "workflow-step-", snapshot.WorkflowSteps)
	updateCounter(&snapshot.NextJobID, "job-", snapshot.Jobs)
	updateCounter(&snapshot.NextStateTransitionID, "state-transition-", snapshot.StateTransitions)

	return nil
}

func (p *PostgresPersister) saveWorkflowRuntime(ctx context.Context, tx *sql.Tx, snapshot Snapshot) error {
	workflowRuns := make([]workflow.WorkflowRun, 0, len(snapshot.WorkflowRuns))
	for _, record := range snapshot.WorkflowRuns {
		workflowRuns = append(workflowRuns, record)
	}
	sort.Slice(workflowRuns, func(i, j int) bool {
		if !workflowRuns[i].CreatedAt.Equal(workflowRuns[j].CreatedAt) {
			return workflowRuns[i].CreatedAt.Before(workflowRuns[j].CreatedAt)
		}
		return strings.Compare(workflowRuns[i].ID, workflowRuns[j].ID) < 0
	})
	for _, record := range workflowRuns {
		if err := saveWorkflowRunExec(ctx, tx, record); err != nil {
			return err
		}
	}

	workflowSteps := make([]workflow.WorkflowStep, 0, len(snapshot.WorkflowSteps))
	for _, record := range snapshot.WorkflowSteps {
		workflowSteps = append(workflowSteps, record)
	}
	sort.Slice(workflowSteps, func(i, j int) bool {
		if workflowSteps[i].WorkflowRunID != workflowSteps[j].WorkflowRunID {
			return strings.Compare(workflowSteps[i].WorkflowRunID, workflowSteps[j].WorkflowRunID) < 0
		}
		if workflowSteps[i].StepOrder != workflowSteps[j].StepOrder {
			return workflowSteps[i].StepOrder < workflowSteps[j].StepOrder
		}
		if !workflowSteps[i].CreatedAt.Equal(workflowSteps[j].CreatedAt) {
			return workflowSteps[i].CreatedAt.Before(workflowSteps[j].CreatedAt)
		}
		return strings.Compare(workflowSteps[i].ID, workflowSteps[j].ID) < 0
	})
	for _, record := range workflowSteps {
		if err := saveWorkflowStepExec(ctx, tx, record); err != nil {
			return err
		}
	}

	jobs := make([]workflow.Job, 0, len(snapshot.Jobs))
	for _, record := range snapshot.Jobs {
		jobs = append(jobs, record)
	}
	sort.Slice(jobs, func(i, j int) bool {
		if jobs[i].Priority != jobs[j].Priority {
			return jobs[i].Priority > jobs[j].Priority
		}
		if !jobs[i].CreatedAt.Equal(jobs[j].CreatedAt) {
			return jobs[i].CreatedAt.Before(jobs[j].CreatedAt)
		}
		return strings.Compare(jobs[i].ID, jobs[j].ID) < 0
	})
	for _, record := range jobs {
		if err := saveJobExec(ctx, tx, record); err != nil {
			return err
		}
	}

	stateTransitions := make([]workflow.StateTransition, 0, len(snapshot.StateTransitions))
	for _, record := range snapshot.StateTransitions {
		stateTransitions = append(stateTransitions, record)
	}
	sort.Slice(stateTransitions, func(i, j int) bool {
		if !stateTransitions[i].CreatedAt.Equal(stateTransitions[j].CreatedAt) {
			return stateTransitions[i].CreatedAt.Before(stateTransitions[j].CreatedAt)
		}
		return strings.Compare(stateTransitions[i].ID, stateTransitions[j].ID) < 0
	})
	for _, record := range stateTransitions {
		if err := saveStateTransitionExec(ctx, tx, record); err != nil {
			return err
		}
	}

	return nil
}
