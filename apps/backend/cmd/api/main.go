package main

import (
	"context"
	"net/http"
	"os"

	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/observability"
)

func main() {
	cfg := config.Load()
	mux := http.NewServeMux()
	cwd, err := os.Getwd()
	if err != nil {
		observability.Logger().Fatal(err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		observability.Logger().Fatal(err)
	}
	store, closeStore, err := db.OpenStore(context.Background(), db.OpenStoreOptions{
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
	connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(store))

	if err := http.ListenAndServe(cfg.HTTPAddr, mux); err != nil {
		observability.Logger().Fatal(err)
	}
}
