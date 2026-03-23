package connect

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestServerRouteDependenciesDoNotExposeRawMemoryStore(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("server.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	text := string(content)
	if strings.Contains(text, "Store            *db.MemoryStore") || strings.Contains(text, "Store *db.MemoryStore") {
		t.Fatalf("expected RouteDependencies to avoid raw *db.MemoryStore field")
	}
	if strings.Contains(text, "type RuntimeDependencies struct") {
		t.Fatalf("expected connect package to avoid RuntimeDependencies composition root")
	}
	if strings.Contains(text, "NewRuntimeDependenciesFromStore") {
		t.Fatalf("expected connect package to avoid NewRuntimeDependenciesFromStore")
	}
}

func TestCmdAPIAvoidsRepositorySetConstruction(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "..", "cmd", "api", "main.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	text := string(content)
	if strings.Contains(text, "runtime.NewRepositorySet(") {
		t.Fatalf("expected cmd/api to construct runtime dependencies via factory, not runtime.NewRepositorySet")
	}
	if strings.Contains(text, "*db.MemoryStore") {
		t.Fatalf("expected cmd/api to avoid raw *db.MemoryStore dependency")
	}
}
