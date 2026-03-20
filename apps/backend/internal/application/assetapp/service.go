package assetapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type Service struct {
	store *db.MemoryStore
}

type CreateImportBatchInput struct {
	ProjectID  string
	OrgID      string
	OperatorID string
	SourceType string
}

type AddCandidateAssetInput struct {
	ShotExecutionID string
	ProjectID       string
	OrgID           string
	ImportBatchID   string
	SourceRunID     string
	SourceType      string
	AssetLocale     string
	RightsStatus    string
	AIAnnotated     bool
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
