package db

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveMigrationsDirFromRepoRoot(t *testing.T) {
	dir, err := ResolveMigrationsDir(filepath.Clean(filepath.Join("..", "..", "..", "..", "..")))
	if err != nil {
		t.Fatalf("ResolveMigrationsDir returned error: %v", err)
	}
	if !strings.HasSuffix(filepath.ToSlash(dir), "infra/migrations") {
		t.Fatalf("expected migrations dir to end with infra/migrations, got %q", dir)
	}
}
