package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"os"

	_ "github.com/lib/pq"

	"github.com/hualala/apps/backend/internal/platform/config"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	handle, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer handle.Close()

	if err := handle.PingContext(context.Background()); err != nil {
		log.Fatal(err)
	}

	result, err := db.EnsureDevBootstrap(context.Background(), handle)
	if err != nil {
		log.Fatal(err)
	}

	body, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	_, _ = os.Stdout.Write(append(body, '\n'))
}
