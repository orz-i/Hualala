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

const (
	transactionBeginMarker  = "BEGIN;"
	transactionCommitMarker = "COMMIT;"
)

func ensureMigrationLedger(ctx context.Context, handle *sql.DB) error {
	if _, err := handle.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("db: ensure schema_migrations: %w", err)
	}
	return nil
}

func migrationApplied(ctx context.Context, handle *sql.DB, filename string) (bool, error) {
	var exists bool
	if err := handle.QueryRowContext(
		ctx,
		`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename = $1)`,
		filename,
	).Scan(&exists); err != nil {
		return false, fmt.Errorf("db: check migration ledger for %s: %w", filename, err)
	}
	return exists, nil
}

func shouldBootstrapMigrationLedger(ctx context.Context, handle *sql.DB) (bool, error) {
	var (
		count         int
		organizations any
		snapshots     any
	)
	if err := handle.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		return false, fmt.Errorf("db: count schema_migrations: %w", err)
	}
	if count > 0 {
		return false, nil
	}
	if err := handle.QueryRowContext(
		ctx,
		`SELECT to_regclass('public.organizations'), to_regclass('public.app_state_snapshots')`,
	).Scan(&organizations, &snapshots); err != nil {
		return false, fmt.Errorf("db: inspect legacy schema for migration ledger bootstrap: %w", err)
	}
	return organizations != nil && snapshots != nil, nil
}

func bootstrapMigrationLedger(ctx context.Context, handle *sql.DB, filenames []string) error {
	tx, err := handle.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("db: begin bootstrap schema_migrations: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()
	for _, filename := range filenames {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
			filename,
		); err != nil {
			return fmt.Errorf("db: bootstrap schema_migrations for %s: %w", filename, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("db: commit bootstrap schema_migrations: %w", err)
	}
	return nil
}

func ResolveMigrationsDir(cwd string) (string, error) {
	if strings.TrimSpace(cwd) == "" {
		return "", errors.New("db: current working directory is required")
	}

	candidates := []string{
		filepath.Join(cwd, "infra", "migrations"),
		filepath.Join(cwd, "..", "..", "infra", "migrations"),
		filepath.Join(cwd, "..", "..", "..", "infra", "migrations"),
		filepath.Join(cwd, "..", "..", "..", "..", "infra", "migrations"),
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
	if err := ensureMigrationLedger(ctx, handle); err != nil {
		return err
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("db: read migrations dir: %w", err)
	}

	files := make([]string, 0)
	filenames := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(strings.ToLower(name), ".sql") {
			files = append(files, filepath.Join(migrationsDir, name))
			filenames = append(filenames, name)
		}
	}
	sort.Strings(files)
	sort.Strings(filenames)

	bootstrapLedger, err := shouldBootstrapMigrationLedger(ctx, handle)
	if err != nil {
		return err
	}
	if bootstrapLedger {
		if err := bootstrapMigrationLedger(ctx, handle, filenames); err != nil {
			return err
		}
	}

	for _, migrationFile := range files {
		filename := filepath.Base(migrationFile)
		applied, err := migrationApplied(ctx, handle, filename)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		payload, err := os.ReadFile(migrationFile)
		if err != nil {
			return fmt.Errorf("db: read migration %s: %w", migrationFile, err)
		}
		migrationSQL := strings.TrimSpace(string(payload))
		if migrationSQL == "" {
			continue
		}
		migrationSQL = stripTransactionWrapper(migrationSQL)
		tx, err := handle.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("db: begin migration %s: %w", filename, err)
		}
		if _, err := tx.ExecContext(ctx, migrationSQL); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("db: execute migration %s: %w", filename, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (filename) VALUES ($1)`, filename); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("db: record migration %s: %w", filename, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("db: commit migration %s: %w", filename, err)
		}
	}

	return nil
}

func stripTransactionWrapper(migrationSQL string) string {
	trimmed := strings.TrimSpace(migrationSQL)
	upper := strings.ToUpper(trimmed)
	if !strings.HasPrefix(upper, transactionBeginMarker) || !strings.HasSuffix(upper, transactionCommitMarker) {
		return trimmed
	}

	inner := strings.TrimSpace(trimmed[len(transactionBeginMarker) : len(trimmed)-len(transactionCommitMarker)])
	if inner == "" {
		return trimmed
	}
	return inner
}
