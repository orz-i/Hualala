package integration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestIntegrationFlowsAvoidRawStoreMapMutation(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("reliability_flow_test.go"))
	if err != nil {
		t.Fatalf("os.ReadFile returned error: %v", err)
	}
	text := string(content)
	for _, forbidden := range []string{
		"store.WorkflowRuns[",
		"store.Budgets[",
		"store.EventPublisher.List(",
	} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("expected reliability_flow_test.go to avoid %q outside integration fixture", forbidden)
		}
	}
}

func TestIntegrationFlowsAvoidManualServiceAssembly(t *testing.T) {
	targets := []string{
		"project_content_flow_test.go",
		"shot_execution_flow_test.go",
		"reliability_flow_test.go",
	}
	for _, target := range targets {
		t.Run(target, func(t *testing.T) {
			content, err := os.ReadFile(filepath.Join(target))
			if err != nil {
				t.Fatalf("os.ReadFile returned error: %v", err)
			}
			text := string(content)
			for _, forbidden := range []string{
				"projectapp.NewService(",
				"contentapp.NewService(",
				"executionapp.NewService(",
				"assetapp.NewService(",
				"billingapp.NewService(",
				"reviewapp.NewService(",
			} {
				if strings.Contains(text, forbidden) {
					t.Fatalf("expected %s to avoid manual service assembly %q", target, forbidden)
				}
			}
		})
	}
}
