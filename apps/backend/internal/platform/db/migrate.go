package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func ResolveMigrationsDir(cwd string) (string, error) {
	if strings.TrimSpace(cwd) == "" {
		return "", errors.New("db: current working directory is required")
	}

	candidates := []string{
		filepath.Join(cwd, "infra", "migrations"),
		filepath.Join(cwd, "..", "..", "infra", "migrations"),
		filepath.Join(cwd, "..", "..", "..", "infra", "migrations"),
	}
	for _, candidate := range candidates {
		resolved := filepath.Clean(candidate)
		info, err := os.Stat(resolved)
		if err == nil && info.IsDir() {
			return resolved, nil
		}
	}

	return "", fmt.Errorf("db: could not resolve migrations dir from %s", cwd)
}

func RunMigrations(ctx context.Context, handle *sql.DB, migrationsDir string) error {
	if handle == nil {
		return errors.New("db: database handle is required for migrations")
	}
	if strings.TrimSpace(migrationsDir) == "" {
		return errors.New("db: migrations directory is required")
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("db: read migrations dir: %w", err)
	}

	files := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(strings.ToLower(name), ".sql") {
			files = append(files, filepath.Join(migrationsDir, name))
		}
	}
	sort.Strings(files)

	for _, migrationFile := range files {
		payload, err := os.ReadFile(migrationFile)
		if err != nil {
			return fmt.Errorf("db: read migration %s: %w", migrationFile, err)
		}
		if strings.TrimSpace(string(payload)) == "" {
			continue
		}
		if _, err := handle.ExecContext(ctx, string(payload)); err != nil {
			return fmt.Errorf("db: execute migration %s: %w", filepath.Base(migrationFile), err)
		}
	}

	return nil
}
