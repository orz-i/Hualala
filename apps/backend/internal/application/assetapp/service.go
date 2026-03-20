package assetapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	assets     db.AssetRepository
	executions db.ExecutionRepository
}

type CreateImportBatchInput struct {
	ProjectID  string `json:"project_id"`
	OrgID      string `json:"org_id"`
	OperatorID string `json:"operator_id"`
	SourceType string `json:"source_type"`
}

type AddCandidateAssetInput struct {
	ShotExecutionID string `json:"shot_execution_id"`
	ProjectID       string `json:"project_id"`
	OrgID           string `json:"org_id"`
	ImportBatchID   string `json:"import_batch_id"`
	SourceRunID     string `json:"source_run_id"`
	SourceType      string `json:"source_type"`
	AssetLocale     string `json:"asset_locale"`
	RightsStatus    string `json:"rights_status"`
	AIAnnotated     bool   `json:"ai_annotated"`
}

type ListCandidateAssetsInput struct {
	ShotExecutionID string
}

type ListImportBatchItemsInput struct {
	ImportBatchID string
}

type BatchConfirmImportBatchItemsInput struct {
	ImportBatchID string
	ItemIDs       []string
}

type GetAssetProvenanceSummaryInput struct {
	AssetID string
}

type AssetProvenanceSummary struct {
	Asset             asset.MediaAsset
	ProvenanceSummary string
}

type GetImportBatchWorkbenchInput struct {
	ImportBatchID string
}

type ImportBatchWorkbench struct {
	ImportBatch        asset.ImportBatch
	UploadSessions     []asset.UploadSession
	UploadFiles        []asset.UploadFile
	MediaAssets        []asset.MediaAsset
	MediaAssetVariants []asset.MediaAssetVariant
	Items              []asset.ImportBatchItem
	CandidateAssets    []asset.CandidateAsset
	ShotExecutions     []execution.ShotExecution
}

func NewService(assets db.AssetRepository, executions db.ExecutionRepository) *Service {
	return &Service{assets: assets, executions: executions}
}

func (s *Service) CreateImportBatch(ctx context.Context, input CreateImportBatchInput) (asset.ImportBatch, error) {
	if s == nil || s.assets == nil {
		return asset.ImportBatch{}, errors.New("assetapp: repository is required")
	}
	if strings.TrimSpace(input.ProjectID) == "" || strings.TrimSpace(input.OrgID) == "" {
		return asset.ImportBatch{}, errors.New("assetapp: project_id and org_id are required")
	}

	now := time.Now().UTC()
	record := asset.ImportBatch{
		ID:         s.assets.GenerateImportBatchID(),
		OrgID:      strings.TrimSpace(input.OrgID),
		ProjectID:  strings.TrimSpace(input.ProjectID),
		OperatorID: strings.TrimSpace(input.OperatorID),
		SourceType: strings.TrimSpace(input.SourceType),
		Status:     "pending_review",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.assets.SaveImportBatch(ctx, record); err != nil {
		return asset.ImportBatch{}, err
	}
	return record, nil
}

func (s *Service) AddCandidateAsset(ctx context.Context, input AddCandidateAssetInput) (asset.CandidateAsset, error) {
	shotExecution, ok := s.executions.GetShotExecution(input.ShotExecutionID)
	if !ok {
		return asset.CandidateAsset{}, errors.New("assetapp: shot execution not found")
	}

	now := time.Now().UTC()
	mediaAsset := asset.MediaAsset{
		ID:            s.assets.GenerateMediaAssetID(),
		OrgID:         strings.TrimSpace(input.OrgID),
		ProjectID:     strings.TrimSpace(input.ProjectID),
		ImportBatchID: strings.TrimSpace(input.ImportBatchID),
		SourceType:    strings.TrimSpace(input.SourceType),
		Locale:        strings.TrimSpace(input.AssetLocale),
		RightsStatus:  strings.TrimSpace(input.RightsStatus),
		AIAnnotated:   input.AIAnnotated,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if mediaAsset.RightsStatus == "" {
		mediaAsset.RightsStatus = "unknown"
	}
	if err := s.assets.SaveMediaAsset(ctx, mediaAsset); err != nil {
		return asset.CandidateAsset{}, err
	}

	candidate := asset.CandidateAsset{
		ID:              s.assets.GenerateCandidateAssetID(),
		ShotExecutionID: strings.TrimSpace(input.ShotExecutionID),
		AssetID:         mediaAsset.ID,
		SourceRunID:     strings.TrimSpace(input.SourceRunID),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.assets.SaveCandidateAsset(ctx, candidate); err != nil {
		return asset.CandidateAsset{}, err
	}

	importBatchItem := asset.ImportBatchItem{
		ID:            s.assets.GenerateImportBatchItemID(),
		ImportBatchID: strings.TrimSpace(input.ImportBatchID),
		Status:        "matched_pending_confirm",
		MatchedShotID: shotExecution.ShotID,
		AssetID:       mediaAsset.ID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.assets.SaveImportBatchItem(ctx, importBatchItem); err != nil {
		return asset.CandidateAsset{}, err
	}

	shotExecution.Status = "candidate_ready"
	shotExecution.UpdatedAt = now
	if err := s.executions.SaveShotExecution(ctx, shotExecution); err != nil {
		return asset.CandidateAsset{}, err
	}

	return candidate, nil
}

func (s *Service) ListCandidateAssets(_ context.Context, input ListCandidateAssetsInput) ([]asset.CandidateAsset, error) {
	if s == nil || s.assets == nil {
		return nil, errors.New("assetapp: repository is required")
	}
	return s.assets.ListCandidateAssetsByExecution(input.ShotExecutionID), nil
}

func (s *Service) ListImportBatchItems(_ context.Context, input ListImportBatchItemsInput) ([]asset.ImportBatchItem, error) {
	if s == nil || s.assets == nil {
		return nil, errors.New("assetapp: repository is required")
	}
	if strings.TrimSpace(input.ImportBatchID) == "" {
		return nil, errors.New("assetapp: import_batch_id is required")
	}
	return s.assets.ListImportBatchItems(input.ImportBatchID), nil
}

func (s *Service) BatchConfirmImportBatchItems(ctx context.Context, input BatchConfirmImportBatchItemsInput) ([]asset.ImportBatchItem, error) {
	if s == nil || s.assets == nil {
		return nil, errors.New("assetapp: repository is required")
	}
	if strings.TrimSpace(input.ImportBatchID) == "" {
		return nil, errors.New("assetapp: import_batch_id is required")
	}
	if len(input.ItemIDs) == 0 {
		return nil, errors.New("assetapp: item_ids are required")
	}

	confirmedItems := make([]asset.ImportBatchItem, 0, len(input.ItemIDs))
	now := time.Now().UTC()
	for _, itemID := range input.ItemIDs {
		record, ok := s.assets.GetImportBatchItem(itemID)
		if !ok || record.ImportBatchID != input.ImportBatchID {
			return nil, fmt.Errorf("assetapp: import batch item %q not found", itemID)
		}
		record.Status = "confirmed"
		record.UpdatedAt = now
		if err := s.assets.SaveImportBatchItem(ctx, record); err != nil {
			return nil, err
		}
		confirmedItems = append(confirmedItems, record)
	}

	if batch, ok := s.assets.GetImportBatch(input.ImportBatchID); ok {
		batch.Status = "confirmed"
		batch.UpdatedAt = now
		if err := s.assets.SaveImportBatch(ctx, batch); err != nil {
			return nil, err
		}
	}

	return confirmedItems, nil
}

func (s *Service) GetImportBatchWorkbench(_ context.Context, input GetImportBatchWorkbenchInput) (ImportBatchWorkbench, error) {
	if s == nil || s.assets == nil || s.executions == nil {
		return ImportBatchWorkbench{}, errors.New("assetapp: repositories are required")
	}
	importBatchID := strings.TrimSpace(input.ImportBatchID)
	if importBatchID == "" {
		return ImportBatchWorkbench{}, errors.New("assetapp: import_batch_id is required")
	}

	importBatch, ok := s.assets.GetImportBatch(importBatchID)
	if !ok {
		return ImportBatchWorkbench{}, errors.New("assetapp: import batch not found")
	}

	workbench := ImportBatchWorkbench{
		ImportBatch:        importBatch,
		UploadSessions:     s.assets.ListUploadSessionsByImportBatch(importBatchID),
		MediaAssets:        s.assets.ListMediaAssetsByImportBatch(importBatchID),
		Items:              s.assets.ListImportBatchItems(importBatchID),
		UploadFiles:        make([]asset.UploadFile, 0),
		MediaAssetVariants: make([]asset.MediaAssetVariant, 0),
		CandidateAssets:    make([]asset.CandidateAsset, 0),
		ShotExecutions:     make([]execution.ShotExecution, 0),
	}

	sessionIDs := make([]string, 0, len(workbench.UploadSessions))
	for _, session := range workbench.UploadSessions {
		sessionIDs = append(sessionIDs, session.ID)
	}
	workbench.UploadFiles = s.assets.ListUploadFilesBySessionIDs(sessionIDs)

	uploadFileIDs := make([]string, 0, len(workbench.UploadFiles))
	for _, uploadFile := range workbench.UploadFiles {
		uploadFileIDs = append(uploadFileIDs, uploadFile.ID)
	}
	workbench.MediaAssetVariants = s.assets.ListMediaAssetVariantsByUploadFileIDs(uploadFileIDs)

	assetIDs := make([]string, 0, len(workbench.MediaAssets)+len(workbench.Items))
	seenAssetIDs := make(map[string]struct{})
	for _, mediaAsset := range workbench.MediaAssets {
		if _, ok := seenAssetIDs[mediaAsset.ID]; ok {
			continue
		}
		seenAssetIDs[mediaAsset.ID] = struct{}{}
		assetIDs = append(assetIDs, mediaAsset.ID)
	}
	for _, item := range workbench.Items {
		if item.AssetID == "" {
			continue
		}
		if _, ok := seenAssetIDs[item.AssetID]; ok {
			continue
		}
		seenAssetIDs[item.AssetID] = struct{}{}
		assetIDs = append(assetIDs, item.AssetID)
	}

	workbench.CandidateAssets = s.assets.ListCandidateAssetsByAssetIDs(assetIDs)
	shotExecutionIDs := make([]string, 0, len(workbench.CandidateAssets))
	seenShotExecutionIDs := make(map[string]struct{})
	for _, candidate := range workbench.CandidateAssets {
		if candidate.ShotExecutionID == "" {
			continue
		}
		if _, ok := seenShotExecutionIDs[candidate.ShotExecutionID]; ok {
			continue
		}
		seenShotExecutionIDs[candidate.ShotExecutionID] = struct{}{}
		shotExecutionIDs = append(shotExecutionIDs, candidate.ShotExecutionID)
	}
	workbench.ShotExecutions = s.executions.ListShotExecutionsByIDs(shotExecutionIDs)

	return workbench, nil
}

func (s *Service) GetAssetProvenanceSummary(_ context.Context, input GetAssetProvenanceSummaryInput) (AssetProvenanceSummary, error) {
	record, ok := s.assets.GetMediaAsset(input.AssetID)
	if !ok {
		return AssetProvenanceSummary{}, errors.New("assetapp: asset not found")
	}

	return AssetProvenanceSummary{
		Asset:             record,
		ProvenanceSummary: fmt.Sprintf("source_type=%s import_batch_id=%s rights_status=%s", record.SourceType, record.ImportBatchID, record.RightsStatus),
	}, nil
}
