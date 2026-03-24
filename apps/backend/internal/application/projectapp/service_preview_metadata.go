package projectapp

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/domain/project"
)

type previewMetadataLookups struct {
	projectRecord     project.Project
	sceneByID         map[string]content.Scene
	shotByID          map[string]content.Shot
	episodeByID       map[string]project.Episode
	assetByID         map[string]asset.MediaAsset
	executionByShotID map[string]execution.ShotExecution
	runsByExecutionID map[string][]execution.ShotExecutionRun
}

func (s *Service) ListPreviewShotOptions(_ context.Context, input ListPreviewShotOptionsInput) ([]PreviewShotOption, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return nil, err
	}

	projectRecord, _ := s.repo.GetProject(projectID)
	sceneRecords := s.listPreviewScopedScenes(projectID, episodeID)

	orderedShots := make([]content.Shot, 0)
	for _, sceneRecord := range sceneRecords {
		shots := append([]content.Shot(nil), s.repo.ListShotsByScene(sceneRecord.ID)...)
		sortPreviewCodedItems(shots, func(item content.Shot) string { return item.Code }, func(item content.Shot) string { return item.ID })
		orderedShots = append(orderedShots, shots...)
	}

	lookups := s.buildPreviewMetadataLookups(projectRecord, sceneRecords, orderedShots, collectShotIDs(orderedShots), nil)
	options := make([]PreviewShotOption, 0, len(orderedShots))
	for _, shotRecord := range orderedShots {
		sceneRecord, ok := lookups.sceneByID[shotRecord.SceneID]
		if !ok {
			continue
		}

		option := PreviewShotOption{
			Shot: s.buildPreviewShotSummary(lookups, sceneRecord, shotRecord),
		}
		if executionRecord, ok := lookups.executionByShotID[shotRecord.ID]; ok {
			option.ShotExecutionID = executionRecord.ID
			option.ShotExecutionStatus = executionRecord.Status
			option.CurrentPrimaryAsset = previewAssetSummaryFromMap(lookups.assetByID, executionRecord.PrimaryAssetID)
			option.LatestRun = latestPreviewRunSummaryFromMap(lookups.runsByExecutionID, executionRecord.ID)
		}
		options = append(options, option)
	}
	return options, nil
}

func (s *Service) buildPreviewWorkbench(record project.PreviewAssembly) PreviewWorkbench {
	projectRecord, _ := s.repo.GetProject(record.ProjectID)
	items := s.repo.ListPreviewAssemblyItems(record.ID)
	lookups := s.buildPreviewMetadataLookups(
		projectRecord,
		nil,
		nil,
		collectPreviewItemShotIDs(items),
		collectPreviewItemAssetIDs(items),
	)

	aggregatedItems := make([]PreviewAssemblyItemState, 0, len(items))
	for _, item := range items {
		state := PreviewAssemblyItemState{
			ID:             item.ID,
			AssemblyID:     item.AssemblyID,
			ShotID:         item.ShotID,
			PrimaryAssetID: item.PrimaryAssetID,
			SourceRunID:    item.SourceRunID,
			Sequence:       item.Sequence,
			CreatedAt:      item.CreatedAt,
			UpdatedAt:      item.UpdatedAt,
			PrimaryAsset:   previewAssetSummaryFromMap(lookups.assetByID, item.PrimaryAssetID),
		}

		shotRecord, shotOK := lookups.shotByID[item.ShotID]
		sceneRecord, sceneOK := lookups.sceneByID[shotRecord.SceneID]
		if shotOK && sceneOK {
			state.Shot = s.buildPreviewShotSummary(lookups, sceneRecord, shotRecord)
			if executionRecord, ok := lookups.executionByShotID[item.ShotID]; ok {
				state.SourceRun = previewRunSummaryByID(lookups.runsByExecutionID[executionRecord.ID], item.SourceRunID)
			}
		}
		aggregatedItems = append(aggregatedItems, state)
	}

	return PreviewWorkbench{
		Assembly: record,
		Items:    aggregatedItems,
	}
}

func (s *Service) listPreviewScopedScenes(projectID string, episodeID string) []content.Scene {
	if strings.TrimSpace(episodeID) != "" {
		sceneRecords := append([]content.Scene(nil), s.repo.ListScenes(projectID, episodeID)...)
		sortPreviewCodedItems(sceneRecords, func(item content.Scene) string { return item.Code }, func(item content.Scene) string { return item.ID })
		return sceneRecords
	}

	episodes := s.repo.ListEpisodesByProject(projectID)
	sceneRecords := make([]content.Scene, 0)
	for _, episodeRecord := range episodes {
		episodeScenes := append([]content.Scene(nil), s.repo.ListScenes(projectID, episodeRecord.ID)...)
		sortPreviewCodedItems(episodeScenes, func(item content.Scene) string { return item.Code }, func(item content.Scene) string { return item.ID })
		sceneRecords = append(sceneRecords, episodeScenes...)
	}
	return sceneRecords
}

func (s *Service) buildPreviewMetadataLookups(
	projectRecord project.Project,
	sceneRecords []content.Scene,
	shotRecords []content.Shot,
	shotIDs []string,
	assetIDs []string,
) previewMetadataLookups {
	lookups := previewMetadataLookups{
		projectRecord:     projectRecord,
		sceneByID:         make(map[string]content.Scene),
		shotByID:          make(map[string]content.Shot),
		episodeByID:       make(map[string]project.Episode),
		assetByID:         make(map[string]asset.MediaAsset),
		executionByShotID: make(map[string]execution.ShotExecution),
		runsByExecutionID: make(map[string][]execution.ShotExecutionRun),
	}

	if len(shotRecords) == 0 && len(shotIDs) > 0 {
		shotRecords = s.repo.ListShotsByIDs(shotIDs)
	}
	for _, shotRecord := range shotRecords {
		lookups.shotByID[shotRecord.ID] = shotRecord
	}

	if len(sceneRecords) == 0 && len(lookups.shotByID) > 0 {
		sceneRecords = s.repo.ListScenesByIDs(collectSceneIDsFromShotsMap(lookups.shotByID))
	}
	for _, sceneRecord := range sceneRecords {
		lookups.sceneByID[sceneRecord.ID] = sceneRecord
		if _, ok := lookups.episodeByID[sceneRecord.EpisodeID]; ok {
			continue
		}
		if episodeRecord, ok := s.repo.GetEpisode(sceneRecord.EpisodeID); ok {
			lookups.episodeByID[sceneRecord.EpisodeID] = episodeRecord
		}
	}

	executionRecords := s.repo.ListShotExecutionsByShotIDs(collectShotIDsFromMap(lookups.shotByID))
	executionIDs := make([]string, 0, len(executionRecords))
	for _, executionRecord := range executionRecords {
		if _, exists := lookups.executionByShotID[executionRecord.ShotID]; exists {
			continue
		}
		lookups.executionByShotID[executionRecord.ShotID] = executionRecord
		executionIDs = append(executionIDs, executionRecord.ID)
		if strings.TrimSpace(executionRecord.PrimaryAssetID) != "" {
			assetIDs = append(assetIDs, executionRecord.PrimaryAssetID)
		}
	}

	for _, assetRecord := range s.repo.ListMediaAssetsByIDs(uniqueNonEmptyStrings(assetIDs)) {
		lookups.assetByID[assetRecord.ID] = assetRecord
	}
	for _, runRecord := range s.repo.ListShotExecutionRunsByExecutionIDs(uniqueNonEmptyStrings(executionIDs)) {
		lookups.runsByExecutionID[runRecord.ShotExecutionID] = append(lookups.runsByExecutionID[runRecord.ShotExecutionID], runRecord)
	}
	return lookups
}

func (s *Service) buildPreviewShotSummary(
	lookups previewMetadataLookups,
	sceneRecord content.Scene,
	shotRecord content.Shot,
) PreviewShotSummary {
	summary := PreviewShotSummary{
		ProjectID:    lookups.projectRecord.ID,
		ProjectTitle: lookups.projectRecord.Title,
		SceneID:      sceneRecord.ID,
		SceneCode:    sceneRecord.Code,
		SceneTitle:   strings.TrimSpace(sceneRecord.Title),
		ShotID:       shotRecord.ID,
		ShotCode:     shotRecord.Code,
		ShotTitle:    strings.TrimSpace(shotRecord.Title),
	}
	if episodeRecord, ok := lookups.episodeByID[sceneRecord.EpisodeID]; ok {
		summary.EpisodeID = episodeRecord.ID
		summary.EpisodeTitle = episodeRecord.Title
	}
	return summary
}

func previewAssetSummaryFromMap(assetByID map[string]asset.MediaAsset, assetID string) *PreviewAssetSummary {
	record, ok := assetByID[strings.TrimSpace(assetID)]
	if !ok {
		return nil
	}
	return &PreviewAssetSummary{
		AssetID:      record.ID,
		MediaType:    record.MediaType,
		RightsStatus: record.RightsStatus,
		AIAnnotated:  record.AIAnnotated,
	}
}

func latestPreviewRunSummaryFromMap(runsByExecutionID map[string][]execution.ShotExecutionRun, executionID string) *PreviewRunSummary {
	runs := runsByExecutionID[strings.TrimSpace(executionID)]
	if len(runs) == 0 {
		return nil
	}
	return previewRunSummaryFromRecord(runs[len(runs)-1])
}

func previewRunSummaryByID(runs []execution.ShotExecutionRun, runID string) *PreviewRunSummary {
	normalizedRunID := strings.TrimSpace(runID)
	if normalizedRunID == "" {
		return nil
	}
	for _, runRecord := range runs {
		if runRecord.ID == normalizedRunID {
			return previewRunSummaryFromRecord(runRecord)
		}
	}
	return nil
}

func previewRunSummaryFromRecord(record execution.ShotExecutionRun) *PreviewRunSummary {
	return &PreviewRunSummary{
		RunID:       record.ID,
		Status:      record.Status,
		TriggerType: record.TriggerType,
	}
}

func sortPreviewCodedItems[T any](items []T, code func(T) string, id func(T) string) {
	sort.SliceStable(items, func(i, j int) bool {
		leftCode := strings.TrimSpace(code(items[i]))
		rightCode := strings.TrimSpace(code(items[j]))
		if leftCode == rightCode {
			return id(items[i]) < id(items[j])
		}
		if leftCode == "" {
			return false
		}
		if rightCode == "" {
			return true
		}
		return leftCode < rightCode
	})
}

func collectPreviewItemShotIDs(items []project.PreviewAssemblyItem) []string {
	shotIDs := make([]string, 0, len(items))
	for _, item := range items {
		shotIDs = append(shotIDs, item.ShotID)
	}
	return uniqueNonEmptyStrings(shotIDs)
}

func collectPreviewItemAssetIDs(items []project.PreviewAssemblyItem) []string {
	assetIDs := make([]string, 0, len(items))
	for _, item := range items {
		assetIDs = append(assetIDs, item.PrimaryAssetID)
	}
	return uniqueNonEmptyStrings(assetIDs)
}

func collectShotIDs(records []content.Shot) []string {
	shotIDs := make([]string, 0, len(records))
	for _, record := range records {
		shotIDs = append(shotIDs, record.ID)
	}
	return uniqueNonEmptyStrings(shotIDs)
}

func collectShotIDsFromMap(records map[string]content.Shot) []string {
	shotIDs := make([]string, 0, len(records))
	for shotID := range records {
		shotIDs = append(shotIDs, shotID)
	}
	return uniqueNonEmptyStrings(shotIDs)
}

func collectSceneIDsFromShotsMap(records map[string]content.Shot) []string {
	sceneIDs := make([]string, 0, len(records))
	for _, record := range records {
		sceneIDs = append(sceneIDs, record.SceneID)
	}
	return uniqueNonEmptyStrings(sceneIDs)
}

func uniqueNonEmptyStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	items := make([]string, 0, len(values))
	for _, value := range values {
		normalizedValue := strings.TrimSpace(value)
		if normalizedValue == "" {
			continue
		}
		if _, ok := seen[normalizedValue]; ok {
			continue
		}
		seen[normalizedValue] = struct{}{}
		items = append(items, normalizedValue)
	}
	sort.Strings(items)
	return items
}
