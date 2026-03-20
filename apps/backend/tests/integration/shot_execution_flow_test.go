package integration

import (
	"context"
	"strings"
	"testing"

	"github.com/hualala/apps/backend/internal/application/assetapp"
	"github.com/hualala/apps/backend/internal/application/billingapp"
	"github.com/hualala/apps/backend/internal/application/contentapp"
	"github.com/hualala/apps/backend/internal/application/executionapp"
	"github.com/hualala/apps/backend/internal/application/projectapp"
	"github.com/hualala/apps/backend/internal/application/reviewapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestShotExecutionFlow(t *testing.T) {
	ctx := context.Background()
	store := openIntegrationStore(t)

	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)
	executionService := executionapp.NewService(store)
	assetService := assetapp.NewService(store)
	billingService := billingapp.NewService(store)
	reviewService := reviewapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   "AI 剧集平台",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN", "en-US"},
		CurrentStage:            "production",
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	episode, err := projectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}

	scene, err := contentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "开场",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}

	shot, err := contentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "主角入场",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	sourceSnapshot, err := contentService.CreateContentSnapshot(ctx, contentapp.CreateContentSnapshotInput{
		OwnerType:     "shot",
		OwnerID:       shot.ID,
		ContentLocale: "zh-CN",
		Body:          "主角推门进入客厅。",
	})
	if err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}

	_, err = contentService.CreateLocalizedSnapshot(ctx, contentapp.CreateLocalizedSnapshotInput{
		SourceSnapshotID: sourceSnapshot.ID,
		ContentLocale:    "en-US",
		Body:             "The protagonist enters the living room.",
	})
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot returned error: %v", err)
	}

	_, err = billingService.SetProjectBudget(ctx, billingapp.SetProjectBudgetInput{
		ProjectID:  project.ID,
		OrgID:      project.OrganizationID,
		LimitCents: 500,
	})
	if err != nil {
		t.Fatalf("SetProjectBudget returned error: %v", err)
	}

	run1, err := executionService.StartShotExecutionRun(ctx, executionapp.StartShotExecutionRunInput{
		ShotID:             shot.ID,
		OperatorID:         db.DefaultDevUserID,
		ProjectID:          project.ID,
		OrgID:              project.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: 120,
	})
	if err != nil {
		t.Fatalf("StartShotExecutionRun returned error: %v", err)
	}
	if run1.RunNumber != 1 {
		t.Fatalf("expected first run number 1, got %d", run1.RunNumber)
	}

	importBatch, err := assetService.CreateImportBatch(ctx, assetapp.CreateImportBatchInput{
		ProjectID:  project.ID,
		OrgID:      project.OrganizationID,
		OperatorID: db.DefaultDevUserID,
		SourceType: "manual_upload",
	})
	if err != nil {
		t.Fatalf("CreateImportBatch returned error: %v", err)
	}

	candidate, err := assetService.AddCandidateAsset(ctx, assetapp.AddCandidateAssetInput{
		ShotExecutionID: run1.ShotExecutionID,
		ProjectID:       project.ID,
		OrgID:           project.OrganizationID,
		ImportBatchID:   importBatch.ID,
		SourceRunID:     run1.ID,
		SourceType:      "manual_upload",
		AssetLocale:     "zh-CN",
		RightsStatus:    "clear",
		AIAnnotated:     true,
	})
	if err != nil {
		t.Fatalf("AddCandidateAsset returned error: %v", err)
	}

	executionAfterCandidate, err := executionService.GetShotExecution(ctx, executionapp.GetShotExecutionInput{
		ShotExecutionID: run1.ShotExecutionID,
	})
	if err != nil {
		t.Fatalf("GetShotExecution returned error: %v", err)
	}
	if executionAfterCandidate.Status != "candidate_ready" {
		t.Fatalf("expected candidate_ready after candidate added, got %q", executionAfterCandidate.Status)
	}

	executionAfterPrimary, err := executionService.SelectPrimaryAsset(ctx, executionapp.SelectPrimaryAssetInput{
		ShotExecutionID: run1.ShotExecutionID,
		AssetID:         candidate.AssetID,
	})
	if err != nil {
		t.Fatalf("SelectPrimaryAsset returned error: %v", err)
	}
	if executionAfterPrimary.Status != "primary_selected" {
		t.Fatalf("expected primary_selected after select primary, got %q", executionAfterPrimary.Status)
	}

	gate, err := executionService.RunSubmissionGateChecks(ctx, executionapp.RunSubmissionGateChecksInput{
		ShotExecutionID: run1.ShotExecutionID,
	})
	if err != nil {
		t.Fatalf("RunSubmissionGateChecks returned error: %v", err)
	}
	if len(gate.FailedChecks) != 0 {
		t.Fatalf("expected no failed checks, got %v", gate.FailedChecks)
	}
	for _, expectedCheck := range []string{
		"structure_complete",
		"content_consistent",
		"source_traceable",
		"rights_cleared",
		"ai_labeled",
		"budget_available",
		"language_consistent",
		"primary_asset_selected",
	} {
		if !contains(gate.PassedChecks, expectedCheck) {
			t.Fatalf("expected passed checks to contain %q, got %v", expectedCheck, gate.PassedChecks)
		}
	}

	evaluationRun, err := reviewService.CreateEvaluationRun(ctx, reviewapp.CreateEvaluationRunInput{
		ShotExecutionID: run1.ShotExecutionID,
		PassedChecks:    gate.PassedChecks,
		FailedChecks:    gate.FailedChecks,
	})
	if err != nil {
		t.Fatalf("CreateEvaluationRun returned error: %v", err)
	}
	if evaluationRun.Status != "passed" {
		t.Fatalf("expected evaluation run status passed, got %q", evaluationRun.Status)
	}

	submitted, err := executionService.SubmitShotForReview(ctx, executionapp.SubmitShotForReviewInput{
		ShotExecutionID: run1.ShotExecutionID,
	})
	if err != nil {
		t.Fatalf("SubmitShotForReview returned error: %v", err)
	}
	if submitted.Status != "submitted_for_review" {
		t.Fatalf("expected submitted_for_review, got %q", submitted.Status)
	}

	reviewRejected, err := reviewService.CreateShotReview(ctx, reviewapp.CreateShotReviewInput{
		ShotExecutionID: run1.ShotExecutionID,
		Conclusion:      "rejected",
		CommentLocale:   "zh-CN",
		Comment:         "镜头节奏需要调整",
	})
	if err != nil {
		t.Fatalf("CreateShotReview rejected returned error: %v", err)
	}
	if reviewRejected.Conclusion != "rejected" {
		t.Fatalf("expected rejected review, got %q", reviewRejected.Conclusion)
	}

	reworkExecution, err := executionService.MarkShotReworkRequired(ctx, executionapp.MarkShotReworkRequiredInput{
		ShotExecutionID: run1.ShotExecutionID,
		Reason:          "镜头节奏需要调整",
	})
	if err != nil {
		t.Fatalf("MarkShotReworkRequired returned error: %v", err)
	}
	if reworkExecution.Status != "rework_required" {
		t.Fatalf("expected rework_required, got %q", reworkExecution.Status)
	}

	run2, err := executionService.StartShotExecutionRun(ctx, executionapp.StartShotExecutionRunInput{
		ShotID:             shot.ID,
		OperatorID:         db.DefaultDevUserID,
		ProjectID:          project.ID,
		OrgID:              project.OrganizationID,
		TriggerType:        "rework",
		EstimatedCostCents: 120,
	})
	if err != nil {
		t.Fatalf("StartShotExecutionRun second returned error: %v", err)
	}
	if run2.RunNumber != 2 {
		t.Fatalf("expected second run number 2, got %d", run2.RunNumber)
	}

	reviewApproved, err := reviewService.CreateShotReview(ctx, reviewapp.CreateShotReviewInput{
		ShotExecutionID: run1.ShotExecutionID,
		Conclusion:      "approved",
		CommentLocale:   "zh-CN",
		Comment:         "可以进入下一阶段",
	})
	if err != nil {
		t.Fatalf("CreateShotReview approved returned error: %v", err)
	}
	if reviewApproved.Conclusion != "approved" {
		t.Fatalf("expected approved review, got %q", reviewApproved.Conclusion)
	}

	approvedExecution, err := executionService.MarkShotApprovedForUse(ctx, executionapp.MarkShotApprovedForUseInput{
		ShotExecutionID: run1.ShotExecutionID,
	})
	if err != nil {
		t.Fatalf("MarkShotApprovedForUse returned error: %v", err)
	}
	if approvedExecution.Status != "approved_for_use" {
		t.Fatalf("expected approved_for_use, got %q", approvedExecution.Status)
	}

	runs, err := executionService.ListShotExecutionRuns(ctx, executionapp.ListShotExecutionRunsInput{
		ShotExecutionID: run1.ShotExecutionID,
	})
	if err != nil {
		t.Fatalf("ListShotExecutionRuns returned error: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("expected 2 runs, got %d", len(runs))
	}
}

func TestShotExecutionBudgetGuard(t *testing.T) {
	ctx := context.Background()
	store := openIntegrationStore(t)

	projectService := projectapp.NewService(store)
	contentService := contentapp.NewService(store)
	executionService := executionapp.NewService(store)
	billingService := billingapp.NewService(store)

	project, err := projectService.CreateProject(ctx, projectapp.CreateProjectInput{
		OrganizationID:          db.DefaultDevOrganizationID,
		OwnerUserID:             db.DefaultDevUserID,
		Title:                   "预算守卫",
		PrimaryContentLocale:    "zh-CN",
		SupportedContentLocales: []string{"zh-CN"},
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	episode, err := projectService.CreateEpisode(ctx, projectapp.CreateEpisodeInput{
		ProjectID: project.ID,
		EpisodeNo: 1,
		Title:     "第一集",
	})
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}

	scene, err := contentService.CreateScene(ctx, contentapp.CreateSceneInput{
		ProjectID: project.ID,
		EpisodeID: episode.ID,
		SceneNo:   1,
		Title:     "预算场景",
	})
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}

	shot, err := contentService.CreateShot(ctx, contentapp.CreateShotInput{
		SceneID: scene.ID,
		ShotNo:  1,
		Title:   "预算镜头",
	})
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}

	_, err = billingService.SetProjectBudget(ctx, billingapp.SetProjectBudgetInput{
		ProjectID:  project.ID,
		OrgID:      project.OrganizationID,
		LimitCents: 200,
	})
	if err != nil {
		t.Fatalf("SetProjectBudget returned error: %v", err)
	}

	_, err = executionService.StartShotExecutionRun(ctx, executionapp.StartShotExecutionRunInput{
		ShotID:             shot.ID,
		OperatorID:         db.DefaultDevUserID,
		ProjectID:          project.ID,
		OrgID:              project.OrganizationID,
		TriggerType:        "manual",
		EstimatedCostCents: 180,
	})
	if err != nil {
		t.Fatalf("first StartShotExecutionRun returned error: %v", err)
	}

	_, err = executionService.StartShotExecutionRun(ctx, executionapp.StartShotExecutionRunInput{
		ShotID:             shot.ID,
		OperatorID:         db.DefaultDevUserID,
		ProjectID:          project.ID,
		OrgID:              project.OrganizationID,
		TriggerType:        "retry",
		EstimatedCostCents: 40,
	})
	if err == nil {
		t.Fatal("expected second StartShotExecutionRun to be blocked by budget guard")
	}
	if !strings.Contains(err.Error(), "budget exceeded") {
		t.Fatalf("expected budget exceeded error, got %v", err)
	}
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
