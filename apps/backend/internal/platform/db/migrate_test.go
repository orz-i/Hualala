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

func TestStripTransactionWrapper(t *testing.T) {
	sql := "BEGIN;\n\nCREATE TABLE demo (id integer);\n\nCOMMIT;"
	got := stripTransactionWrapper(sql)
	if strings.Contains(strings.ToUpper(got), transactionBeginMarker) {
		t.Fatalf("expected stripped migration to remove BEGIN wrapper, got %q", got)
	}
	if strings.Contains(strings.ToUpper(got), transactionCommitMarker) {
		t.Fatalf("expected stripped migration to remove COMMIT wrapper, got %q", got)
	}
	if !strings.Contains(got, "CREATE TABLE demo") {
		t.Fatalf("expected stripped migration body to be preserved, got %q", got)
	}
}

func TestStripTransactionWrapperKeepsPlainSQL(t *testing.T) {
	sql := "CREATE TABLE demo (id integer);"
	got := stripTransactionWrapper(sql)
	if got != sql {
		t.Fatalf("expected plain SQL to remain unchanged, got %q", got)
	}
}
