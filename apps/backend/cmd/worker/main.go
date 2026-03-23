package main

import (
	"context"
	"os"
	"os/signal"
	"time"

	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/observability"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

func main() {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	cwd, err := os.Getwd()
	if err != nil {
		observability.Logger().Fatal(err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		observability.Logger().Fatal(err)
	}
	store, closeStore, err := db.OpenStore(ctx, db.OpenStoreOptions{
		Driver:        cfg.DBDriver,
		DatabaseURL:   cfg.DatabaseURL,
		AutoMigrate:   cfg.AutoMigrate,
		MigrationsDir: migrationsDir,
	})
	if err != nil {
		observability.Logger().Fatal(err)
	}
	defer func() {
		if closeStore != nil {
			if err := closeStore(); err != nil {
				observability.Logger().Println(err)
			}
		}
	}()

	service := runtime.NewFactory(store).WorkerServices().WorkflowService
	if service == nil {
		observability.Logger().Fatal("worker: workflow service is required")
	}

	pollInterval := cfg.WorkerPollInterval
	if pollInterval <= 0 {
		pollInterval = 250 * time.Millisecond
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		processed, err := service.ProcessNextWorkflowJob(ctx)
		if err != nil {
			observability.Logger().Printf("worker: process workflow job failed: %v", err)
			if !waitForPoll(ctx, pollInterval) {
				return
			}
			continue
		}
		if processed {
			continue
		}
		if !waitForPoll(ctx, pollInterval) {
			return
		}
	}
}

func waitForPoll(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
