package config

import (
	"os"
	"testing"
)

func TestLoadReadsDatabaseSettingsFromEnvironment(t *testing.T) {
	t.Setenv("HTTP_ADDR", ":18080")
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("DATABASE_URL", "postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable")
	t.Setenv("AUTO_MIGRATE", "true")

	cfg := Load()

	if got := cfg.HTTPAddr; got != ":18080" {
		t.Fatalf("expected HTTPAddr %q, got %q", ":18080", got)
	}
	if got := cfg.DBDriver; got != "postgres" {
		t.Fatalf("expected DBDriver %q, got %q", "postgres", got)
	}
	if got := cfg.DatabaseURL; got != "postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable" {
		t.Fatalf("unexpected DatabaseURL %q", got)
	}
	if !cfg.AutoMigrate {
		t.Fatalf("expected AutoMigrate to be true")
	}
}

func TestLoadFallsBackToSafeDefaults(t *testing.T) {
	for _, key := range []string{"HTTP_ADDR", "DB_DRIVER", "DATABASE_URL", "AUTO_MIGRATE"} {
		if err := os.Unsetenv(key); err != nil {
			t.Fatalf("Unsetenv(%q) returned error: %v", key, err)
		}
	}

	cfg := Load()

	if got := cfg.HTTPAddr; got != ":8080" {
		t.Fatalf("expected default HTTPAddr %q, got %q", ":8080", got)
	}
	if got := cfg.DBDriver; got != "postgres" {
		t.Fatalf("expected default DBDriver %q, got %q", "postgres", got)
	}
	if got := cfg.DatabaseURL; got != "" {
		t.Fatalf("expected default DatabaseURL to be empty, got %q", got)
	}
	if !cfg.AutoMigrate {
		t.Fatalf("expected AutoMigrate to default to true")
	}
}
