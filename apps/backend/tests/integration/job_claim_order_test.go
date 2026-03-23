package integration

import (
	"context"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestPostgresStoreClaimNextJobRespectsPriorityAndCreatedAt(t *testing.T) {
	fixture := openIntegrationFixture(t)
	ctx := context.Background()
	now := time.Now().UTC()
	project, err := fixture.Services.ProjectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   "Job Claim Order Project",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	highPriorityRunID := fixture.Store.GenerateWorkflowRunID()
	firstNormalRunID := fixture.Store.GenerateWorkflowRunID()
	secondNormalRunID := fixture.Store.GenerateWorkflowRunID()

	for _, job := range []workflow.Job{
		{
			ID:           fixture.Store.GenerateJobID(),
			OrgID:        db.DefaultDevOrganizationID,
			ProjectID:    project.ID,
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   highPriorityRunID,
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     200,
			Payload:      `{"workflow_run_id":"workflow-run-1","attempt_count":1}`,
			ScheduledAt:  now.Add(-1 * time.Minute),
			CreatedAt:    now.Add(2 * time.Second),
			UpdatedAt:    now.Add(2 * time.Second),
		},
		{
			ID:           fixture.Store.GenerateJobID(),
			OrgID:        db.DefaultDevOrganizationID,
			ProjectID:    project.ID,
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   firstNormalRunID,
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     100,
			Payload:      `{"workflow_run_id":"workflow-run-2","attempt_count":1}`,
			ScheduledAt:  now.Add(-1 * time.Minute),
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           fixture.Store.GenerateJobID(),
			OrgID:        db.DefaultDevOrganizationID,
			ProjectID:    project.ID,
			ResourceType: workflow.ResourceTypeWorkflowRun,
			ResourceID:   secondNormalRunID,
			JobType:      workflow.JobTypeWorkflowDispatch,
			Status:       workflow.StatusPending,
			Priority:     100,
			Payload:      `{"workflow_run_id":"workflow-run-3","attempt_count":1}`,
			ScheduledAt:  now.Add(-1 * time.Minute),
			CreatedAt:    now.Add(1 * time.Second),
			UpdatedAt:    now.Add(1 * time.Second),
		},
	} {
		if err := fixture.Store.SaveJob(ctx, job); err != nil {
			t.Fatalf("SaveJob returned error: %v", err)
		}
	}

	first, ok, err := fixture.Store.ClaimNextJob(ctx, workflow.JobTypeWorkflowDispatch)
	if err != nil {
		t.Fatalf("ClaimNextJob returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected first claim to return a job")
	}
	if got := first.ResourceID; got != highPriorityRunID {
		t.Fatalf("expected highest-priority job %q, got %q", highPriorityRunID, got)
	}

	second, ok, err := fixture.Store.ClaimNextJob(ctx, workflow.JobTypeWorkflowDispatch)
	if err != nil {
		t.Fatalf("second ClaimNextJob returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected second claim to return a job")
	}
	if got := second.ResourceID; got != firstNormalRunID {
		t.Fatalf("expected second job %q, got %q", firstNormalRunID, got)
	}
}
