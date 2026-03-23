package runtime

import (
	"context"
	"testing"

	"github.com/hualala/apps/backend/internal/application/workflowapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestFactoryAcceptsRuntimeStore(t *testing.T) {
	var store db.RuntimeStore = db.NewMemoryStore()

	factory := NewFactory(store)
	repositories := factory.Repositories()
	services := factory.Services()

	if repositories.AuthOrg == nil || repositories.ProjectContent == nil || repositories.Executions == nil || repositories.Assets == nil {
		t.Fatalf("expected runtime factory to expose repository set")
	}
	if services.AuthService == nil || services.OrgService == nil || services.ProjectService == nil || services.ExecutionService == nil || services.UploadService == nil {
		t.Fatalf("expected runtime factory to expose service set")
	}
}

func TestFactoryWorkflowServiceResolvesKnownProviderWithoutCallerInput(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	services := NewFactory(store).Services()

	record, err := services.WorkflowService.StartWorkflow(ctx, workflowapp.StartWorkflowInput{
		OrganizationID: "org-1",
		ProjectID:      "project-1",
		WorkflowType:   "asset.import",
		ResourceID:     "batch-1",
	})
	if err != nil {
		t.Fatalf("StartWorkflow returned error: %v", err)
	}
	if got := record.Provider; got != "seedance" {
		t.Fatalf("expected resolved provider seedance, got %q", got)
	}
	if record.ExternalRequestID == "" {
		t.Fatalf("expected runtime workflow to expose external_request_id")
	}
}
