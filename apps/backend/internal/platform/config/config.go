package config

import (
	"os"
	"strconv"
	"time"
)

const (
	defaultHTTPAddr           = ":8080"
	defaultDBDriver           = "postgres"
	defaultWorkerPollInterval = 250 * time.Millisecond
)

type Config struct {
	HTTPAddr           string
	DBDriver           string
	DatabaseURL        string
	AutoMigrate        bool
	WorkerPollInterval time.Duration
}

func Load() Config {
	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = defaultHTTPAddr
	}

	dbDriver := os.Getenv("DB_DRIVER")
	if dbDriver == "" {
		dbDriver = defaultDBDriver
	}

	databaseURL := os.Getenv("DATABASE_URL")
	workerPollInterval := defaultWorkerPollInterval
	if raw := os.Getenv("WORKER_POLL_INTERVAL_MS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			workerPollInterval = time.Duration(parsed) * time.Millisecond
		}
	}

	return Config{
		HTTPAddr:           httpAddr,
		DBDriver:           dbDriver,
		DatabaseURL:        databaseURL,
		AutoMigrate:        os.Getenv("AUTO_MIGRATE") != "false",
		WorkerPollInterval: workerPollInterval,
	}
}
