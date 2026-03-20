package runtime

import (
	"testing"

	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestFactoryAcceptsRuntimeStore(t *testing.T) {
	var store db.RuntimeStore = db.NewMemoryStore()

	factory := NewFactory(store)
	repositories := factory.Repositories()
	services := factory.Services()

	if repositories.ProjectContent == nil || repositories.Executions == nil || repositories.Assets == nil {
		t.Fatalf("expected runtime factory to expose repository set")
	}
	if services.ProjectService == nil || services.ExecutionService == nil || services.UploadService == nil {
		t.Fatalf("expected runtime factory to expose service set")
	}
}
