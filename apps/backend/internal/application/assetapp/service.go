package assetapp

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
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

func NewService(store *db.MemoryStore) *Service {
	return &Service{store: store}
}

func (s *Service) CreateImportBatch(_ context.Context, input CreateImportBatchInput) (asset.ImportBatch, error) {
	if s == nil || s.store == nil {
		return asset.ImportBatch{}, errors.New("assetapp: store is required")
	}
	if strings.TrimSpace(input.ProjectID) == "" || strings.TrimSpace(input.OrgID) == "" {
		return asset.ImportBatch{}, errors.New("assetapp: project_id and org_id are required")
	}

	now := time.Now().UTC()
	record := asset.ImportBatch{
		ID:         s.store.NextImportBatchID(),
		OrgID:      strings.TrimSpace(input.OrgID),
		ProjectID:  strings.TrimSpace(input.ProjectID),
		OperatorID: strings.TrimSpace(input.OperatorID),
		SourceType: strings.TrimSpace(input.SourceType),
		Status:     "pending_review",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	s.store.ImportBatches[record.ID] = record
	return record, nil
}

func (s *Service) AddCandidateAsset(_ context.Context, input AddCandidateAssetInput) (asset.CandidateAsset, error) {
	shotExecution, ok := s.store.ShotExecutions[input.ShotExecutionID]
	if !ok {
		return asset.CandidateAsset{}, errors.New("assetapp: shot execution not found")
	}

	now := time.Now().UTC()
	mediaAsset := asset.MediaAsset{
		ID:            s.store.NextMediaAssetID(),
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
		mediaAsset.RightsStatus = "pending"
	}
	s.store.MediaAssets[mediaAsset.ID] = mediaAsset

	candidate := asset.CandidateAsset{
		ID:              s.store.NextCandidateAssetID(),
		ShotExecutionID: strings.TrimSpace(input.ShotExecutionID),
		AssetID:         mediaAsset.ID,
		SourceRunID:     strings.TrimSpace(input.SourceRunID),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	s.store.CandidateAssets[candidate.ID] = candidate

	importBatchItem := asset.ImportBatchItem{
		ID:            s.store.NextImportBatchItemID(),
		ImportBatchID: strings.TrimSpace(input.ImportBatchID),
		Status:        "matched_pending_confirm",
		MatchedShotID: shotExecution.ShotID,
		AssetID:       mediaAsset.ID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.store.ImportBatchItems[importBatchItem.ID] = importBatchItem

	shotExecution.Status = "candidate_ready"
	shotExecution.UpdatedAt = now
	s.store.ShotExecutions[shotExecution.ID] = shotExecution

	return candidate, nil
}

func (s *Service) ListCandidateAssets(_ context.Context, input ListCandidateAssetsInput) ([]asset.CandidateAsset, error) {
	candidates := make([]asset.CandidateAsset, 0)
	for _, candidate := range s.store.CandidateAssets {
		if candidate.ShotExecutionID == input.ShotExecutionID {
			candidates = append(candidates, candidate)
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].ID < candidates[j].ID
	})

	return candidates, nil
}

func (s *Service) ListImportBatchItems(_ context.Context, input ListImportBatchItemsInput) ([]asset.ImportBatchItem, error) {
	if strings.TrimSpace(input.ImportBatchID) == "" {
		return nil, errors.New("assetapp: import_batch_id is required")
	}

	items := make([]asset.ImportBatchItem, 0)
	for _, item := range s.store.ImportBatchItems {
		if item.ImportBatchID == input.ImportBatchID {
			items = append(items, item)
		}
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})

	return items, nil
}

func (s *Service) BatchConfirmImportBatchItems(_ context.Context, input BatchConfirmImportBatchItemsInput) ([]asset.ImportBatchItem, error) {
	if strings.TrimSpace(input.ImportBatchID) == "" {
		return nil, errors.New("assetapp: import_batch_id is required")
	}
	if len(input.ItemIDs) == 0 {
		return nil, errors.New("assetapp: item_ids are required")
	}

	confirmedItems := make([]asset.ImportBatchItem, 0, len(input.ItemIDs))
	now := time.Now().UTC()
	for _, itemID := range input.ItemIDs {
		record, ok := s.store.ImportBatchItems[itemID]
		if !ok || record.ImportBatchID != input.ImportBatchID {
			return nil, fmt.Errorf("assetapp: import batch item %q not found", itemID)
		}
		record.Status = "confirmed"
		record.UpdatedAt = now
		s.store.ImportBatchItems[itemID] = record
		confirmedItems = append(confirmedItems, record)
	}

	if batch, ok := s.store.ImportBatches[input.ImportBatchID]; ok {
		batch.Status = "confirmed"
		batch.UpdatedAt = now
		s.store.ImportBatches[input.ImportBatchID] = batch
	}

	sort.Slice(confirmedItems, func(i, j int) bool {
		return confirmedItems[i].ID < confirmedItems[j].ID
	})

	return confirmedItems, nil
}

func (s *Service) GetImportBatchWorkbench(_ context.Context, input GetImportBatchWorkbenchInput) (ImportBatchWorkbench, error) {
	if s == nil || s.store == nil {
		return ImportBatchWorkbench{}, errors.New("assetapp: store is required")
	}
	importBatchID := strings.TrimSpace(input.ImportBatchID)
	if importBatchID == "" {
		return ImportBatchWorkbench{}, errors.New("assetapp: import_batch_id is required")
	}

	importBatch, ok := s.store.ImportBatches[importBatchID]
	if !ok {
		return ImportBatchWorkbench{}, errors.New("assetapp: import batch not found")
	}

	workbench := ImportBatchWorkbench{
		ImportBatch:        importBatch,
		UploadSessions:     make([]asset.UploadSession, 0),
		UploadFiles:        make([]asset.UploadFile, 0),
		MediaAssets:        make([]asset.MediaAsset, 0),
		MediaAssetVariants: make([]asset.MediaAssetVariant, 0),
		Items:              make([]asset.ImportBatchItem, 0),
		CandidateAssets:    make([]asset.CandidateAsset, 0),
		ShotExecutions:     make([]execution.ShotExecution, 0),
	}

	sessionIDs := make(map[string]struct{})
	uploadFileIDs := make(map[string]struct{})
	assetIDs := make(map[string]struct{})

	for _, session := range s.store.UploadSessions {
		if session.ImportBatchID == importBatchID {
			workbench.UploadSessions = append(workbench.UploadSessions, session)
			sessionIDs[session.ID] = struct{}{}
		}
	}
	for _, uploadFile := range s.store.UploadFiles {
		if _, ok := sessionIDs[uploadFile.UploadSessionID]; ok {
			workbench.UploadFiles = append(workbench.UploadFiles, uploadFile)
			uploadFileIDs[uploadFile.ID] = struct{}{}
		}
	}
	for _, mediaAsset := range s.store.MediaAssets {
		if mediaAsset.ImportBatchID == importBatchID {
			workbench.MediaAssets = append(workbench.MediaAssets, mediaAsset)
			assetIDs[mediaAsset.ID] = struct{}{}
		}
	}
	for _, variant := range s.store.MediaAssetVariants {
		if _, ok := uploadFileIDs[variant.UploadFileID]; ok {
			workbench.MediaAssetVariants = append(workbench.MediaAssetVariants, variant)
		}
	}
	for _, item := range s.store.ImportBatchItems {
		if item.ImportBatchID == importBatchID {
			workbench.Items = append(workbench.Items, item)
			if item.AssetID != "" {
				assetIDs[item.AssetID] = struct{}{}
			}
		}
	}
	for _, candidate := range s.store.CandidateAssets {
		if _, ok := assetIDs[candidate.AssetID]; ok {
			workbench.CandidateAssets = append(workbench.CandidateAssets, candidate)
		}
	}
	shotExecutionIDs := make(map[string]struct{})
	for _, candidate := range workbench.CandidateAssets {
		if candidate.ShotExecutionID != "" {
			shotExecutionIDs[candidate.ShotExecutionID] = struct{}{}
		}
	}
	for _, shotExecution := range s.store.ShotExecutions {
		if _, ok := shotExecutionIDs[shotExecution.ID]; ok {
			workbench.ShotExecutions = append(workbench.ShotExecutions, shotExecution)
		}
	}

	sort.Slice(workbench.UploadSessions, func(i, j int) bool { return workbench.UploadSessions[i].ID < workbench.UploadSessions[j].ID })
	sort.Slice(workbench.UploadFiles, func(i, j int) bool { return workbench.UploadFiles[i].ID < workbench.UploadFiles[j].ID })
	sort.Slice(workbench.MediaAssets, func(i, j int) bool { return workbench.MediaAssets[i].ID < workbench.MediaAssets[j].ID })
	sort.Slice(workbench.MediaAssetVariants, func(i, j int) bool { return workbench.MediaAssetVariants[i].ID < workbench.MediaAssetVariants[j].ID })
	sort.Slice(workbench.Items, func(i, j int) bool { return workbench.Items[i].ID < workbench.Items[j].ID })
	sort.Slice(workbench.CandidateAssets, func(i, j int) bool { return workbench.CandidateAssets[i].ID < workbench.CandidateAssets[j].ID })
	sort.Slice(workbench.ShotExecutions, func(i, j int) bool { return workbench.ShotExecutions[i].ID < workbench.ShotExecutions[j].ID })

	return workbench, nil
}

func (s *Service) GetAssetProvenanceSummary(_ context.Context, input GetAssetProvenanceSummaryInput) (AssetProvenanceSummary, error) {
	record, ok := s.store.MediaAssets[input.AssetID]
	if !ok {
		return AssetProvenanceSummary{}, errors.New("assetapp: asset not found")
	}

	return AssetProvenanceSummary{
		Asset:             record,
		ProvenanceSummary: fmt.Sprintf("source_type=%s import_batch_id=%s rights_status=%s", record.SourceType, record.ImportBatchID, record.RightsStatus),
	}, nil
}
