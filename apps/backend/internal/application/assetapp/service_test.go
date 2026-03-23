package assetapp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestListImportBatchesFiltersSortsAndAggregatesCounts(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store, store.Publisher())

	batchEarly := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "upload_session",
		Status:     "pending_review",
		CreatedAt:  time.Date(2026, 3, 21, 8, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 8, 1, 0, 0, time.UTC),
	}
	batchLatest := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-2",
		SourceType: "workflow_import",
		Status:     "confirmed",
		CreatedAt:  time.Date(2026, 3, 21, 9, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 9, 5, 0, 0, time.UTC),
	}
	batchOtherProject := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-2",
		OperatorID: "user-3",
		SourceType: "upload_session",
		Status:     "pending_review",
		CreatedAt:  time.Date(2026, 3, 21, 10, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 10, 1, 0, 0, time.UTC),
	}
	for _, record := range []asset.ImportBatch{batchEarly, batchLatest, batchOtherProject} {
		if err := store.SaveImportBatch(ctx, record); err != nil {
			t.Fatalf("SaveImportBatch returned error: %v", err)
		}
	}

	if err := store.SaveUploadSession(ctx, asset.UploadSession{
		ID:            store.GenerateUploadSessionID(),
		OrgID:         "org-1",
		ProjectID:     "project-1",
		ImportBatchID: batchLatest.ID,
		FileName:      "shot-a.png",
		Status:        "pending",
		CreatedAt:     time.Date(2026, 3, 21, 9, 1, 0, 0, time.UTC),
		ExpiresAt:     time.Date(2026, 3, 21, 10, 1, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("SaveUploadSession returned error: %v", err)
	}
	if err := store.SaveUploadSession(ctx, asset.UploadSession{
		ID:            store.GenerateUploadSessionID(),
		OrgID:         "org-1",
		ProjectID:     "project-1",
		ImportBatchID: batchLatest.ID,
		FileName:      "shot-b.png",
		Status:        "uploaded",
		CreatedAt:     time.Date(2026, 3, 21, 9, 2, 0, 0, time.UTC),
		ExpiresAt:     time.Date(2026, 3, 21, 10, 2, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("SaveUploadSession returned error: %v", err)
	}

	assetA := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-1",
		ProjectID:     "project-1",
		ImportBatchID: batchLatest.ID,
		SourceType:    "upload_session",
		RightsStatus:  "clear",
		CreatedAt:     time.Date(2026, 3, 21, 9, 2, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 21, 9, 2, 0, 0, time.UTC),
	}
	assetB := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-1",
		ProjectID:     "project-1",
		ImportBatchID: batchLatest.ID,
		SourceType:    "workflow_import",
		RightsStatus:  "clear",
		CreatedAt:     time.Date(2026, 3, 21, 9, 3, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 21, 9, 3, 0, 0, time.UTC),
	}
	for _, record := range []asset.MediaAsset{assetA, assetB} {
		if err := store.SaveMediaAsset(ctx, record); err != nil {
			t.Fatalf("SaveMediaAsset returned error: %v", err)
		}
	}

	if err := store.SaveImportBatchItem(ctx, asset.ImportBatchItem{
		ID:            store.GenerateImportBatchItemID(),
		ImportBatchID: batchLatest.ID,
		Status:        "confirmed",
		AssetID:       assetA.ID,
		CreatedAt:     time.Date(2026, 3, 21, 9, 2, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 21, 9, 4, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("SaveImportBatchItem returned error: %v", err)
	}
	if err := store.SaveImportBatchItem(ctx, asset.ImportBatchItem{
		ID:            store.GenerateImportBatchItemID(),
		ImportBatchID: batchLatest.ID,
		Status:        "matched_pending_confirm",
		AssetID:       assetB.ID,
		CreatedAt:     time.Date(2026, 3, 21, 9, 3, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 21, 9, 4, 30, 0, time.UTC),
	}); err != nil {
		t.Fatalf("SaveImportBatchItem returned error: %v", err)
	}

	if err := store.SaveCandidateAsset(ctx, asset.CandidateAsset{
		ID:              store.GenerateCandidateAssetID(),
		ShotExecutionID: "shot-exec-1",
		AssetID:         assetB.ID,
		SourceRunID:     "workflow-run-1",
		CreatedAt:       time.Date(2026, 3, 21, 9, 3, 0, 0, time.UTC),
		UpdatedAt:       time.Date(2026, 3, 21, 9, 3, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("SaveCandidateAsset returned error: %v", err)
	}

	records, err := service.ListImportBatches(ctx, ListImportBatchesInput{
		ProjectID: "project-1",
	})
	if err != nil {
		t.Fatalf("ListImportBatches returned error: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 import batches for project-1, got %d", len(records))
	}
	if got := records[0].ImportBatch.ID; got != batchLatest.ID {
		t.Fatalf("expected latest batch %q first, got %q", batchLatest.ID, got)
	}
	if got := records[0].UploadSessionCount; got != 2 {
		t.Fatalf("expected upload_session_count 2, got %d", got)
	}
	if got := records[0].ItemCount; got != 2 {
		t.Fatalf("expected item_count 2, got %d", got)
	}
	if got := records[0].ConfirmedItemCount; got != 1 {
		t.Fatalf("expected confirmed_item_count 1, got %d", got)
	}
	if got := records[0].CandidateAssetCount; got != 1 {
		t.Fatalf("expected candidate_asset_count 1, got %d", got)
	}
	if got := records[0].MediaAssetCount; got != 2 {
		t.Fatalf("expected media_asset_count 2, got %d", got)
	}

	filtered, err := service.ListImportBatches(ctx, ListImportBatchesInput{
		ProjectID:  "project-1",
		Status:     "confirmed",
		SourceType: "workflow_import",
	})
	if err != nil {
		t.Fatalf("ListImportBatches filtered returned error: %v", err)
	}
	if len(filtered) != 1 {
		t.Fatalf("expected 1 filtered import batch, got %d", len(filtered))
	}
	if got := filtered[0].ImportBatch.ID; got != batchLatest.ID {
		t.Fatalf("expected filtered batch %q, got %q", batchLatest.ID, got)
	}
}

func TestGetAssetProvenanceSummaryIncludesStructuredFields(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, store, store.Publisher())

	batch := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "workflow_import",
		Status:     "confirmed",
		CreatedAt:  time.Date(2026, 3, 21, 8, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 8, 1, 0, 0, time.UTC),
	}
	if err := store.SaveImportBatch(ctx, batch); err != nil {
		t.Fatalf("SaveImportBatch returned error: %v", err)
	}

	mediaAsset := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-1",
		ProjectID:     "project-1",
		ImportBatchID: batch.ID,
		MediaType:     "audio",
		SourceType:    "workflow_import",
		Locale:        "zh-CN",
		RightsStatus:  "clear",
		AIAnnotated:   true,
		CreatedAt:     time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 21, 8, 3, 0, 0, time.UTC),
	}
	if err := store.SaveMediaAsset(ctx, mediaAsset); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}

	uploadFile := asset.UploadFile{
		ID:              store.GenerateUploadFileID(),
		UploadSessionID: store.GenerateUploadSessionID(),
		FileName:        "candidate.png",
		MimeType:        "image/png",
		Checksum:        "sha256:abc",
		SizeBytes:       2048,
		CreatedAt:       time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
	}
	if err := store.SaveUploadFile(ctx, uploadFile); err != nil {
		t.Fatalf("SaveUploadFile returned error: %v", err)
	}

	for _, variantType := range []string{"original", "thumbnail"} {
		if err := store.SaveMediaAssetVariant(ctx, asset.MediaAssetVariant{
			ID:           store.GenerateMediaAssetVariantID(),
			AssetID:      mediaAsset.ID,
			UploadFileID: uploadFile.ID,
			VariantType:  variantType,
			MimeType:     "image/png",
			Width:        1280,
			Height:       720,
			DurationMS:   64000,
			CreatedAt:    time.Date(2026, 3, 21, 8, 2, 30, 0, time.UTC),
		}); err != nil {
			t.Fatalf("SaveMediaAssetVariant returned error: %v", err)
		}
	}

	candidate := asset.CandidateAsset{
		ID:              store.GenerateCandidateAssetID(),
		ShotExecutionID: "shot-exec-1",
		AssetID:         mediaAsset.ID,
		SourceRunID:     "workflow-run-1",
		CreatedAt:       time.Date(2026, 3, 21, 8, 4, 0, 0, time.UTC),
		UpdatedAt:       time.Date(2026, 3, 21, 8, 4, 0, 0, time.UTC),
	}
	if err := store.SaveCandidateAsset(ctx, candidate); err != nil {
		t.Fatalf("SaveCandidateAsset returned error: %v", err)
	}

	record, err := service.GetAssetProvenanceSummary(ctx, GetAssetProvenanceSummaryInput{
		AssetID: mediaAsset.ID,
	})
	if err != nil {
		t.Fatalf("GetAssetProvenanceSummary returned error: %v", err)
	}
	if got := record.Asset.ID; got != mediaAsset.ID {
		t.Fatalf("expected asset %q, got %q", mediaAsset.ID, got)
	}
	if got := record.Asset.MediaType; got != "audio" {
		t.Fatalf("expected media_type %q, got %q", "audio", got)
	}
	if got := record.ImportBatchID; got != batch.ID {
		t.Fatalf("expected import_batch_id %q, got %q", batch.ID, got)
	}
	if got := record.CandidateAssetID; got != candidate.ID {
		t.Fatalf("expected candidate_asset_id %q, got %q", candidate.ID, got)
	}
	if got := record.ShotExecutionID; got != candidate.ShotExecutionID {
		t.Fatalf("expected shot_execution_id %q, got %q", candidate.ShotExecutionID, got)
	}
	if got := record.SourceRunID; got != candidate.SourceRunID {
		t.Fatalf("expected source_run_id %q, got %q", candidate.SourceRunID, got)
	}
	if got := record.VariantCount; got != 2 {
		t.Fatalf("expected variant_count 2, got %d", got)
	}
	if got := record.ProvenanceSummary; got == "" {
		t.Fatalf("expected non-empty provenance_summary")
	}
}

func TestAddCandidateAssetPersistsImportBatchStatusAndPublishesMatchingEvent(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	store.Publisher().Reset()
	service := NewService(store, store, store.Publisher())

	importBatch := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "manual_upload",
		Status:     "pending_review",
		CreatedAt:  time.Date(2026, 3, 21, 8, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 8, 1, 0, 0, time.UTC),
	}
	if err := store.SaveImportBatch(ctx, importBatch); err != nil {
		t.Fatalf("SaveImportBatch returned error: %v", err)
	}

	shotExecution := execution.ShotExecution{
		ID:        store.GenerateShotExecutionID(),
		OrgID:     "org-1",
		ProjectID: "project-1",
		ShotID:    "shot-1",
		Status:    "queued",
		CreatedAt: time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
	}
	if err := store.SaveShotExecution(ctx, shotExecution); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}

	candidate, err := service.AddCandidateAsset(ctx, AddCandidateAssetInput{
		ShotExecutionID: shotExecution.ID,
		ProjectID:       importBatch.ProjectID,
		OrgID:           importBatch.OrgID,
		ImportBatchID:   importBatch.ID,
		SourceRunID:     "workflow-run-1",
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AIAnnotated:     true,
	})
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	updatedBatch, ok := store.GetImportBatch(importBatch.ID)
	if !ok {
		t.Fatalf("expected import batch %q to exist", importBatch.ID)
	}
	if got := updatedBatch.Status; got != "matched_pending_confirm" {
		t.Fatalf("expected persisted import batch status matched_pending_confirm, got %q", got)
	}

	events := store.Publisher().List(importBatch.OrgID, importBatch.ProjectID, "")
	if len(events) == 0 {
		t.Fatalf("expected asset.import_batch.updated event to be published")
	}
	latestEvent := events[len(events)-1]
	if got := latestEvent.EventType; got != "asset.import_batch.updated" {
		t.Fatalf("expected latest event type asset.import_batch.updated, got %q", got)
	}

	var payload asset.ImportBatchUpdatedEventPayload
	if err := json.Unmarshal([]byte(latestEvent.Payload), &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if got := payload.ImportBatchID; got != importBatch.ID {
		t.Fatalf("expected import_batch_id %q, got %q", importBatch.ID, got)
	}
	if got := payload.Status; got != updatedBatch.Status {
		t.Fatalf("expected payload status %q, got %q", updatedBatch.Status, got)
	}
	if got := payload.CandidateAssetID; got != candidate.ID {
		t.Fatalf("expected candidate_asset_id %q, got %q", candidate.ID, got)
	}
	if got := payload.UploadSessionID; got != "" {
		t.Fatalf("expected empty upload_session_id for AddCandidateAsset event, got %q", got)
	}
	if !strings.Contains(payload.Reason, "candidate_asset.added") {
		t.Fatalf("expected reason candidate_asset.added, got %q", payload.Reason)
	}
}

func TestAddCandidateAssetRejectsScopeMismatchBeforePersisting(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	store.Publisher().Reset()
	service := NewService(store, store, store.Publisher())

	importBatch := asset.ImportBatch{
		ID:         store.GenerateImportBatchID(),
		OrgID:      "org-1",
		ProjectID:  "project-1",
		OperatorID: "user-1",
		SourceType: "manual_upload",
		Status:     "pending_review",
		CreatedAt:  time.Date(2026, 3, 21, 8, 0, 0, 0, time.UTC),
		UpdatedAt:  time.Date(2026, 3, 21, 8, 1, 0, 0, time.UTC),
	}
	if err := store.SaveImportBatch(ctx, importBatch); err != nil {
		t.Fatalf("SaveImportBatch returned error: %v", err)
	}

	shotExecution := execution.ShotExecution{
		ID:        store.GenerateShotExecutionID(),
		OrgID:     "org-1",
		ProjectID: "project-2",
		ShotID:    "shot-1",
		Status:    "queued",
		CreatedAt: time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 3, 21, 8, 2, 0, 0, time.UTC),
	}
	if err := store.SaveShotExecution(ctx, shotExecution); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}

	_, err := service.AddCandidateAsset(ctx, AddCandidateAssetInput{
		ShotExecutionID: shotExecution.ID,
		ProjectID:       importBatch.ProjectID,
		OrgID:           importBatch.OrgID,
		ImportBatchID:   importBatch.ID,
		SourceRunID:     "workflow-run-1",
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AIAnnotated:     true,
	})
	if err == nil {
		t.Fatal("expected scope mismatch to be rejected")
	}
	if !strings.Contains(err.Error(), "permission denied") {
		t.Fatalf("expected permission denied error, got %v", err)
	}

	if len(store.MediaAssets) != 0 {
		t.Fatalf("expected no media assets after scope mismatch, got %d", len(store.MediaAssets))
	}
	if len(store.CandidateAssets) != 0 {
		t.Fatalf("expected no candidate assets after scope mismatch, got %d", len(store.CandidateAssets))
	}
	if len(store.ImportBatchItems) != 0 {
		t.Fatalf("expected no import batch items after scope mismatch, got %d", len(store.ImportBatchItems))
	}

	updatedBatch, ok := store.GetImportBatch(importBatch.ID)
	if !ok {
		t.Fatalf("expected import batch %q to exist", importBatch.ID)
	}
	if got := updatedBatch.Status; got != "pending_review" {
		t.Fatalf("expected import batch status to remain pending_review, got %q", got)
	}

	publishedEvents := store.Publisher().List(importBatch.OrgID, importBatch.ProjectID, "")
	if len(publishedEvents) != 0 {
		t.Fatalf("expected no project-scoped events after scope mismatch, got %d", len(publishedEvents))
	}
}
