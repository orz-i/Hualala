package connect

import "testing"

func TestMarkShotReworkRequiredPublishesShotExecutionUpdated(t *testing.T) {
	testMarkShotReworkRequiredPublishesShotExecutionUpdated(t)
}

func TestAddCandidateAssetPublishesShotExecutionUpdated(t *testing.T) {
	testAddCandidateAssetPublishesShotExecutionUpdated(t)
}

func TestAddCandidateAssetRejectsScopeMismatch(t *testing.T) {
	testAddCandidateAssetRejectsScopeMismatch(t)
}

func TestAssetServiceWritesPublishImportBatchProjectEvents(t *testing.T) {
	testAssetServiceWritesPublishImportBatchProjectEvents(t)
}
