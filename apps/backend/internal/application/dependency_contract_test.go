package application_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPhase2AppServicesAvoidRawMemoryStoreDependency(t *testing.T) {
	targets := []string{
		filepath.Join("projectapp", "service.go"),
		filepath.Join("contentapp", "service.go"),
		filepath.Join("executionapp", "service.go"),
		filepath.Join("assetapp", "service.go"),
		filepath.Join("reviewapp", "service.go"),
		filepath.Join("billingapp", "service.go"),
	}

	for _, target := range targets {
		t.Run(target, func(t *testing.T) {
			content, err := os.ReadFile(target)
			if err != nil {
				t.Fatalf("os.ReadFile returned error: %v", err)
			}
			if strings.Contains(string(content), "*db.MemoryStore") {
				t.Fatalf("expected %s to avoid raw *db.MemoryStore dependency", target)
			}
		})
	}
}
