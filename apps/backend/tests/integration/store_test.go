package integration

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func openIntegrationStore(t *testing.T) *db.MemoryStore {
	t.Helper()

	cfg := config.Load()
	store, closeFn, err := db.OpenStore(context.Background(), db.OpenStoreOptions{
		Driver:        cfg.DBDriver,
		DatabaseURL:   cfg.DatabaseURL,
		AutoMigrate:   cfg.AutoMigrate,
		MigrationsDir: filepath.Join("infra", "migrations"),
		StoreKey:      fmt.Sprintf("integration-%s", t.Name()),
	})
	if err != nil {
		t.Fatalf("OpenStore returned error: %v", err)
	}

	t.Cleanup(func() {
		if closeFn != nil {
			if err := closeFn(); err != nil {
				t.Fatalf("closeFn returned error: %v", err)
			}
		}
	})

	return store
}
