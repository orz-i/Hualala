package executionapp

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestSelectPrimaryAssetAllowsGrantedConsentReuse(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, nil, store, nil, store.Publisher())

	shotExecution := execution.ShotExecution{
		ID:        store.GenerateShotExecutionID(),
		OrgID:     "org-live-1",
		ProjectID: "project-live-1",
		ShotID:    "shot-live-1",
		Status:    "queued",
		CreatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
	}
	if err := store.SaveShotExecution(ctx, shotExecution); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}

	mediaAsset := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-live-1",
		ProjectID:     "project-source-9",
		ImportBatchID: store.GenerateImportBatchID(),
		MediaType:     "image",
		SourceType:    "upload_session",
		Locale:        "zh-CN",
		RightsStatus:  "clear",
		ConsentStatus: "granted",
		AIAnnotated:   true,
		CreatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
	}
	if err := store.SaveMediaAsset(ctx, mediaAsset); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}

	record, err := service.SelectPrimaryAsset(ctx, SelectPrimaryAssetInput{
		ShotExecutionID: shotExecution.ID,
		AssetID:         mediaAsset.ID,
	})
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	if got := record.PrimaryAssetID; got != mediaAsset.ID {
		t.Fatalf("expected primary_asset_id %q, got %q", mediaAsset.ID, got)
	}
}

func TestSelectPrimaryAssetFailsClosedForMissingAiConsent(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, nil, store, nil, store.Publisher())

	shotExecution := execution.ShotExecution{
		ID:        store.GenerateShotExecutionID(),
		OrgID:     "org-live-1",
		ProjectID: "project-live-1",
		ShotID:    "shot-live-1",
		Status:    "queued",
		CreatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
	}
	if err := store.SaveShotExecution(ctx, shotExecution); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}

	mediaAsset := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-live-1",
		ProjectID:     "project-source-9",
		ImportBatchID: store.GenerateImportBatchID(),
		MediaType:     "image",
		SourceType:    "upload_session",
		Locale:        "zh-CN",
		RightsStatus:  "clear",
		ConsentStatus: "unknown",
		AIAnnotated:   true,
		CreatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
	}
	if err := store.SaveMediaAsset(ctx, mediaAsset); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}

	_, err := service.SelectPrimaryAsset(ctx, SelectPrimaryAssetInput{
		ShotExecutionID: shotExecution.ID,
		AssetID:         mediaAsset.ID,
	})
	if err == nil {
		t.Fatal("expected SelectPrimaryAsset to reject ai asset without granted consent")
	}
	if !strings.Contains(err.Error(), "failed precondition") {
		t.Fatalf("expected failed precondition error, got %v", err)
	}
	if updated, ok := store.GetShotExecution(shotExecution.ID); !ok {
		t.Fatalf("expected shot execution %q to still exist", shotExecution.ID)
	} else if updated.PrimaryAssetID != "" {
		t.Fatalf("expected primary_asset_id to remain empty, got %q", updated.PrimaryAssetID)
	}
}

func TestSelectPrimaryAssetFailsClosedForMissingSourceProject(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	service := NewService(store, nil, store, nil, store.Publisher())

	shotExecution := execution.ShotExecution{
		ID:        store.GenerateShotExecutionID(),
		OrgID:     "org-live-1",
		ProjectID: "project-live-1",
		ShotID:    "shot-live-1",
		Status:    "queued",
		CreatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 3, 25, 1, 0, 0, 0, time.UTC),
	}
	if err := store.SaveShotExecution(ctx, shotExecution); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}

	mediaAsset := asset.MediaAsset{
		ID:            store.GenerateMediaAssetID(),
		OrgID:         "org-live-1",
		ProjectID:     "",
		ImportBatchID: store.GenerateImportBatchID(),
		MediaType:     "image",
		SourceType:    "upload_session",
		Locale:        "zh-CN",
		RightsStatus:  "clear",
		ConsentStatus: "not_required",
		AIAnnotated:   false,
		CreatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
		UpdatedAt:     time.Date(2026, 3, 25, 1, 1, 0, 0, time.UTC),
	}
	if err := store.SaveMediaAsset(ctx, mediaAsset); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}

	_, err := service.SelectPrimaryAsset(ctx, SelectPrimaryAssetInput{
		ShotExecutionID: shotExecution.ID,
		AssetID:         mediaAsset.ID,
	})
	if err == nil {
		t.Fatal("expected SelectPrimaryAsset to reject asset without source project")
	}
	if !strings.Contains(err.Error(), "source project is unavailable") {
		t.Fatalf("expected missing source project error, got %v", err)
	}
}
