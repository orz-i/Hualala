package integration

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"

	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	_ "github.com/lib/pq"
)

func openIntegrationStore(t *testing.T) *db.MemoryStore {
	t.Helper()

	cfg := config.Load()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	if cfg.DBDriver == "postgres" {
		handle, err := sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			t.Fatalf("sql.Open returned error: %v", err)
		}
		defer handle.Close()
		if err := handle.PingContext(context.Background()); err != nil {
			t.Fatalf("PingContext returned error: %v", err)
		}
		if cfg.AutoMigrate {
			if err := db.RunMigrations(context.Background(), handle, migrationsDir); err != nil {
				t.Fatalf("RunMigrations returned error: %v", err)
			}
		}
		if _, err := db.EnsureDevBootstrap(context.Background(), handle); err != nil {
			t.Fatalf("EnsureDevBootstrap returned error: %v", err)
		}
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
