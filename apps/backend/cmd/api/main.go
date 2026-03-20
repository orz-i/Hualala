package main

import (
	"net/http"

	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/observability"
)

func main() {
	cfg := config.Load()
	mux := http.NewServeMux()
	store := db.NewMemoryStore()
	connectiface.RegisterRoutes(mux, connectiface.NewRouteDependencies(store))

	if err := http.ListenAndServe(cfg.HTTPAddr, mux); err != nil {
		observability.Logger().Fatal(err)
	}
}
