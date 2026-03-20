package integration

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func openIntegrationStore(t *testing.T) *db.MemoryStore {
	t.Helper()

	cfg := config.Load()
	if cfg.DBDriver == "postgres" {
		if _, err := db.EnsureDevBootstrapWithURL(context.Background(), cfg.DatabaseURL); err != nil {
			t.Fatalf("EnsureDevBootstrapWithURL returned error: %v", err)
		}
	}
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	runtimeStore, closeFn, err := db.OpenStore(context.Background(), db.OpenStoreOptions{
		Driver:        cfg.DBDriver,
		DatabaseURL:   cfg.DatabaseURL,
		AutoMigrate:   cfg.AutoMigrate,
		MigrationsDir: migrationsDir,
		StoreKey:      fmt.Sprintf("integration-%s", t.Name()),
	})
	if err != nil {
		t.Fatalf("OpenStore returned error: %v", err)
	}
	store, ok := runtimeStore.(*db.MemoryStore)
	if !ok {
		t.Fatalf("OpenStore returned %T, want *db.MemoryStore", runtimeStore)
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
