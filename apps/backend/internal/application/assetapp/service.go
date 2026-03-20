package assetapp

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
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

type GetAssetProvenanceSummaryInput struct {
	AssetID string
}

type AssetProvenanceSummary struct {
	Asset             asset.MediaAsset
	ProvenanceSummary string
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
	if _, ok := s.store.ShotExecutions[input.ShotExecutionID]; !ok {
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

	shotExecution := s.store.ShotExecutions[input.ShotExecutionID]
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
