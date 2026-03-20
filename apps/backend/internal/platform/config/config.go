package config

import "os"

const (
	defaultHTTPAddr    = ":8080"
	defaultDBDriver    = "postgres"
	defaultDatabaseURL = "postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable"
)

type Config struct {
	HTTPAddr    string
	DBDriver    string
	DatabaseURL string
	AutoMigrate bool
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
	if databaseURL == "" {
		databaseURL = defaultDatabaseURL
	}

	return Config{
		HTTPAddr:    httpAddr,
		DBDriver:    dbDriver,
		DatabaseURL: databaseURL,
		AutoMigrate: os.Getenv("AUTO_MIGRATE") != "false",
	}
}
