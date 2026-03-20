package main

import (
	"context"
	"database/sql"
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

	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	migrationsDir, err := db.ResolveMigrationsDir(cwd)
	if err != nil {
		log.Fatal(err)
	}

	if err := db.RunMigrations(context.Background(), handle, migrationsDir); err != nil {
		log.Fatal(err)
	}
}
