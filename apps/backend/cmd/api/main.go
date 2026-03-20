package main

import (
	"net/http"

	connectiface "github.com/hualala/apps/backend/internal/interfaces/connect"
	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/observability"
)

func main() {
	cfg := config.Load()
	mux := http.NewServeMux()
	connectiface.RegisterRoutes(mux)

	if err := http.ListenAndServe(cfg.HTTPAddr, mux); err != nil {
		observability.Logger().Fatal(err)
	}
}
