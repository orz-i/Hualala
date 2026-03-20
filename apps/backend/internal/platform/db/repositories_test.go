package db

import "testing"

func TestMemoryStoreImplementsPhase2Repositories(t *testing.T) {
	var _ ProjectContentRepository = (*MemoryStore)(nil)
	var _ ExecutionRepository = (*MemoryStore)(nil)
	var _ AssetRepository = (*MemoryStore)(nil)
	var _ ReviewBillingRepository = (*MemoryStore)(nil)
	var _ PolicyReader = (*MemoryStore)(nil)
	var _ GatewayResultStore = (*MemoryStore)(nil)
	var _ WorkflowRepository = (*MemoryStore)(nil)
	var _ RuntimeStore = (*MemoryStore)(nil)
}
