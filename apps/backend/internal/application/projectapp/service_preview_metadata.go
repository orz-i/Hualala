package projectapp

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/hualala/apps/backend/internal/domain/content"
	"github.com/hualala/apps/backend/internal/domain/project"
)

func (s *Service) ListPreviewShotOptions(ctx context.Context, input ListPreviewShotOptionsInput) ([]PreviewShotOption, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projectapp: repository is required")
	}
	projectID, episodeID, err := s.normalizePreviewScope(input.ProjectID, input.EpisodeID)
	if err != nil {
		return nil, err
	}

	projectRecord, _ := s.repo.GetProject(projectID)
	scenes := append([]content.Scene(nil), s.repo.ListScenes(projectID, episodeID)...)
	sort.SliceStable(scenes, func(i, j int) bool {
		if scenes[i].Code == scenes[j].Code {
			return scenes[i].ID < scenes[j].ID
		}
		if strings.TrimSpace(scenes[i].Code) == "" {
			return false
		}
		if strings.TrimSpace(scenes[j].Code) == "" {
			return true
		}
		return scenes[i].Code < scenes[j].Code
	})

	options := make([]PreviewShotOption, 0)
	for _, scene := range scenes {
		shots := append([]content.Shot(nil), s.repo.ListShotsByScene(scene.ID)...)
		sort.SliceStable(shots, func(i, j int) bool {
			if shots[i].Code == shots[j].Code {
				return shots[i].ID < shots[j].ID
			}
			if strings.TrimSpace(shots[i].Code) == "" {
				return false
			}
			if strings.TrimSpace(shots[j].Code) == "" {
				return true
			}
			return shots[i].Code < shots[j].Code
		})

		for _, shot := range shots {
			option := PreviewShotOption{
				Shot: s.buildPreviewShotSummary(projectRecord, scene, shot, input.DisplayLocale),
			}
			if executionRecord, ok := s.repo.FindShotExecutionByShotID(shot.ID); ok {
				option.ShotExecutionID = executionRecord.ID
				option.ShotExecutionStatus = executionRecord.Status
				option.CurrentPrimaryAsset = s.previewAssetSummary(executionRecord.PrimaryAssetID)
				option.LatestRun = s.latestPreviewRunSummary(executionRecord.ID)
			}
			options = append(options, option)
		}
	}
	return options, nil
}

func (s *Service) buildPreviewWorkbench(record project.PreviewAssembly, displayLocale string) PreviewWorkbench {
	projectRecord, _ := s.repo.GetProject(record.ProjectID)
	items := s.repo.ListPreviewAssemblyItems(record.ID)
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
			PrimaryAsset:   s.previewAssetSummary(item.PrimaryAssetID),
			SourceRun:      s.previewItemRunSummary(item.ShotID, item.SourceRunID),
		}
		if shotRecord, ok := s.repo.GetShot(item.ShotID); ok {
			if sceneRecord, ok := s.repo.GetScene(shotRecord.SceneID); ok {
				state.Shot = s.buildPreviewShotSummary(projectRecord, sceneRecord, shotRecord, displayLocale)
			}
		}
		aggregatedItems = append(aggregatedItems, state)
	}

	return PreviewWorkbench{
		Assembly: record,
		Items:    aggregatedItems,
	}
}

func (s *Service) buildPreviewShotSummary(
	projectRecord project.Project,
	sceneRecord content.Scene,
	shotRecord content.Shot,
	displayLocale string,
) PreviewShotSummary {
	summary := PreviewShotSummary{
		ProjectID:    projectRecord.ID,
		ProjectTitle: projectRecord.Title,
		SceneID:      sceneRecord.ID,
		SceneCode:    sceneRecord.Code,
		SceneTitle:   resolvePreviewDisplayTitle(sceneRecord.Title, sceneRecord.SourceLocale, displayLocale),
		ShotID:       shotRecord.ID,
		ShotCode:     shotRecord.Code,
		ShotTitle:    resolvePreviewDisplayTitle(shotRecord.Title, shotRecord.SourceLocale, displayLocale),
	}
	if episodeRecord, ok := s.repo.GetEpisode(sceneRecord.EpisodeID); ok {
		summary.EpisodeID = episodeRecord.ID
		summary.EpisodeTitle = episodeRecord.Title
	}
	return summary
}

func (s *Service) previewAssetSummary(assetID string) *PreviewAssetSummary {
	normalizedAssetID := strings.TrimSpace(assetID)
	if normalizedAssetID == "" {
		return nil
	}
	record, ok := s.repo.GetMediaAsset(normalizedAssetID)
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

func (s *Service) previewItemRunSummary(shotID string, runID string) *PreviewRunSummary {
	normalizedRunID := strings.TrimSpace(runID)
	if normalizedRunID == "" {
		return nil
	}
	executionRecord, ok := s.repo.FindShotExecutionByShotID(strings.TrimSpace(shotID))
	if !ok {
		return nil
	}
	for _, run := range s.repo.ListShotExecutionRuns(executionRecord.ID) {
		if run.ID == normalizedRunID {
			return &PreviewRunSummary{
				RunID:       run.ID,
				Status:      run.Status,
				TriggerType: run.TriggerType,
			}
		}
	}
	return nil
}

func (s *Service) latestPreviewRunSummary(shotExecutionID string) *PreviewRunSummary {
	runs := s.repo.ListShotExecutionRuns(strings.TrimSpace(shotExecutionID))
	if len(runs) == 0 {
		return nil
	}
	record := runs[len(runs)-1]
	return &PreviewRunSummary{
		RunID:       record.ID,
		Status:      record.Status,
		TriggerType: record.TriggerType,
	}
}

func resolvePreviewDisplayTitle(title string, sourceLocale string, displayLocale string) string {
	normalizedTitle := strings.TrimSpace(title)
	if normalizedTitle == "" {
		return ""
	}
	normalizedDisplayLocale := strings.TrimSpace(displayLocale)
	if normalizedDisplayLocale == "" {
		return normalizedTitle
	}
	if strings.EqualFold(normalizedDisplayLocale, strings.TrimSpace(sourceLocale)) {
		return normalizedTitle
	}

	// Phase 3 foundation 先冻结 display_locale 契约；当前 repo 还没有 scene/shot 标题的多语言真相。
	return normalizedTitle
}
