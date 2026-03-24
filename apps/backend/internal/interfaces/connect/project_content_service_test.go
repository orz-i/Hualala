package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	contentv1 "github.com/hualala/apps/backend/gen/hualala/content/v1"
	contentv1connect "github.com/hualala/apps/backend/gen/hualala/content/v1/contentv1connect"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
	"github.com/hualala/apps/backend/internal/domain/asset"
	"github.com/hualala/apps/backend/internal/domain/execution"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestProjectAndContentRoutes(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)
	contentClient := contentv1connect.NewContentServiceClient(server.Client(), server.URL)

	projectResp, err := projectClient.CreateProject(ctx, connectrpc.NewRequest(&projectv1.CreateProjectRequest{
		OrgId:       "org-1",
		Title:       "Real Backend",
		OwnerUserId: "user-1",
	}))
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	projectID := projectResp.Msg.GetProject().GetProjectId()
	if projectID == "" {
		t.Fatalf("expected project id")
	}

	episodeResp, err := projectClient.CreateEpisode(ctx, connectrpc.NewRequest(&projectv1.CreateEpisodeRequest{
		ProjectId:     projectID,
		EpisodeNumber: 1,
		Title:         "第一集",
	}))
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}
	episodeID := episodeResp.Msg.GetEpisode().GetEpisodeId()
	if episodeID == "" {
		t.Fatalf("expected episode id")
	}

	sceneResp, err := contentClient.CreateScene(ctx, connectrpc.NewRequest(&contentv1.CreateSceneRequest{
		ProjectId:   projectID,
		EpisodeId:   episodeID,
		SceneNumber: 1,
		Title:       "开场",
	}))
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}
	sceneID := sceneResp.Msg.GetScene().GetId()
	if sceneID == "" {
		t.Fatalf("expected scene id")
	}

	shotResp, err := contentClient.CreateShot(ctx, connectrpc.NewRequest(&contentv1.CreateShotRequest{
		SceneId:    sceneID,
		ShotNumber: 1,
		Title:      "主角入场",
	}))
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}
	shotID := shotResp.Msg.GetShot().GetId()
	if shotID == "" {
		t.Fatalf("expected shot id")
	}

	sceneTitleSnapshot, err := contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "scene",
		OwnerId:       sceneID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "开场",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot(scene title) returned error: %v", err)
	}

	_, err = contentClient.CreateLocalizedSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateLocalizedSnapshotRequest{
		SourceSnapshotId: sceneTitleSnapshot.Msg.GetSnapshot().GetId(),
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Opening",
	}))
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot(scene title) returned error: %v", err)
	}

	shotTitleSnapshot, err := contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "shot",
		OwnerId:       shotID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "主角入场",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot(shot title) returned error: %v", err)
	}

	_, err = contentClient.CreateLocalizedSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateLocalizedSnapshotRequest{
		SourceSnapshotId: shotTitleSnapshot.Msg.GetSnapshot().GetId(),
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Hero enters",
	}))
	if err != nil {
		t.Fatalf("CreateLocalizedSnapshot(shot title) returned error: %v", err)
	}

	sourceContentSnapshot, err := contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "shot",
		OwnerId:       shotID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "content",
		Body:          "主角推门进入客厅。",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
	}
	if got := sourceContentSnapshot.Msg.GetSnapshot().GetSnapshotKind(); got != "content" {
		t.Fatalf("expected source content snapshot kind %q, got %q", "content", got)
	}

	listEpisodesResp, err := projectClient.ListEpisodes(ctx, connectrpc.NewRequest(&projectv1.ListEpisodesRequest{
		ProjectId: projectID,
	}))
	if err != nil {
		t.Fatalf("ListEpisodes returned error: %v", err)
	}
	if len(listEpisodesResp.Msg.GetEpisodes()) != 1 {
		t.Fatalf("expected 1 episode, got %d", len(listEpisodesResp.Msg.GetEpisodes()))
	}

	listScenesResp, err := contentClient.ListScenes(ctx, connectrpc.NewRequest(&contentv1.ListScenesRequest{
		ProjectId:     projectID,
		EpisodeId:     episodeID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("ListScenes returned error: %v", err)
	}
	if len(listScenesResp.Msg.GetScenes()) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(listScenesResp.Msg.GetScenes()))
	}
	if got := listScenesResp.Msg.GetScenes()[0].GetTitle(); got != "Opening" {
		t.Fatalf("expected localized scene title %q, got %q", "Opening", got)
	}

	getShotResp, err := contentClient.GetShot(ctx, connectrpc.NewRequest(&contentv1.GetShotRequest{
		ShotId:        shotID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("GetShot returned error: %v", err)
	}
	if got := getShotResp.Msg.GetShot().GetId(); got != shotID {
		t.Fatalf("expected shot %q, got %q", shotID, got)
	}
	if got := getShotResp.Msg.GetShot().GetTitle(); got != "Hero enters" {
		t.Fatalf("expected localized shot title %q, got %q", "Hero enters", got)
	}

	_, err = contentClient.CreateLocalizedSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateLocalizedSnapshotRequest{
		SourceSnapshotId: sourceContentSnapshot.Msg.GetSnapshot().GetId(),
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Hero enters living room.",
	}))
	if err == nil {
		t.Fatalf("expected CreateLocalizedSnapshot to reject mismatched snapshot kind")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeFailedPrecondition {
		t.Fatalf("expected failed precondition, got %v", connectrpc.CodeOf(err))
	}
}

func TestCollaborationAndPreviewRoutes(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)
	contentClient := contentv1connect.NewContentServiceClient(server.Client(), server.URL)

	projectResp, err := projectClient.CreateProject(ctx, connectrpc.NewRequest(&projectv1.CreateProjectRequest{
		OrgId:       "org-1",
		Title:       "Phase 2 Foundation",
		OwnerUserId: "user-1",
	}))
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	projectID := projectResp.Msg.GetProject().GetProjectId()

	episodeResp, err := projectClient.CreateEpisode(ctx, connectrpc.NewRequest(&projectv1.CreateEpisodeRequest{
		ProjectId:     projectID,
		EpisodeNumber: 1,
		Title:         "第一集",
	}))
	if err != nil {
		t.Fatalf("CreateEpisode returned error: %v", err)
	}
	episodeID := episodeResp.Msg.GetEpisode().GetEpisodeId()

	sceneResp, err := contentClient.CreateScene(ctx, connectrpc.NewRequest(&contentv1.CreateSceneRequest{
		ProjectId:   projectID,
		EpisodeId:   episodeID,
		SceneNumber: 1,
		Title:       "开场",
	}))
	if err != nil {
		t.Fatalf("CreateScene returned error: %v", err)
	}
	sceneID := sceneResp.Msg.GetScene().GetId()

	firstShotResp, err := contentClient.CreateShot(ctx, connectrpc.NewRequest(&contentv1.CreateShotRequest{
		SceneId:    sceneID,
		ShotNumber: 1,
		Title:      "第一镜",
	}))
	if err != nil {
		t.Fatalf("CreateShot #1 returned error: %v", err)
	}
	secondShotResp, err := contentClient.CreateShot(ctx, connectrpc.NewRequest(&contentv1.CreateShotRequest{
		SceneId:    sceneID,
		ShotNumber: 2,
		Title:      "第二镜",
	}))
	if err != nil {
		t.Fatalf("CreateShot #2 returned error: %v", err)
	}

	sceneTitleSnapshot, err := contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "scene",
		OwnerId:       sceneID,
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "开场",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot(scene title) returned error: %v", err)
	}
	if _, err := contentClient.CreateLocalizedSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateLocalizedSnapshotRequest{
		SourceSnapshotId: sceneTitleSnapshot.Msg.GetSnapshot().GetId(),
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "Opening",
	})); err != nil {
		t.Fatalf("CreateLocalizedSnapshot(scene title) returned error: %v", err)
	}

	shotTitleSnapshot, err := contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "shot",
		OwnerId:       firstShotResp.Msg.GetShot().GetId(),
		ContentLocale: "zh-CN",
		SnapshotKind:  "title",
		Body:          "第一镜",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot(shot title) returned error: %v", err)
	}
	if _, err := contentClient.CreateLocalizedSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateLocalizedSnapshotRequest{
		SourceSnapshotId: shotTitleSnapshot.Msg.GetSnapshot().GetId(),
		ContentLocale:    "en-US",
		SnapshotKind:     "title",
		Body:             "First shot localized",
	})); err != nil {
		t.Fatalf("CreateLocalizedSnapshot(shot title) returned error: %v", err)
	}

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id=org-1&project_id="+projectID, nil)
	if err != nil {
		t.Fatalf("http.NewRequestWithContext returned error: %v", err)
	}
	sseReq.Header.Set("Cookie", authsession.BuildRequestCookieHeader(connectTestOrgID, connectTestUserID))
	sseResp, err := server.Client().Do(sseReq)
	if err != nil {
		t.Fatalf("SSE request returned error: %v", err)
	}
	defer sseResp.Body.Close()
	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE status 200, got %d", sseResp.StatusCode)
	}

	initialSession, err := contentClient.GetCollaborationSession(ctx, connectrpc.NewRequest(&contentv1.GetCollaborationSessionRequest{
		OwnerType: "shot",
		OwnerId:   firstShotResp.Msg.GetShot().GetId(),
	}))
	if err != nil {
		t.Fatalf("GetCollaborationSession returned error: %v", err)
	}
	if got := initialSession.Msg.GetSession().GetOwnerId(); got != firstShotResp.Msg.GetShot().GetId() {
		t.Fatalf("expected session owner %q, got %q", firstShotResp.Msg.GetShot().GetId(), got)
	}

	claimed, err := contentClient.UpsertCollaborationLease(ctx, connectrpc.NewRequest(&contentv1.UpsertCollaborationLeaseRequest{
		OwnerType:       "shot",
		OwnerId:         firstShotResp.Msg.GetShot().GetId(),
		ActorUserId:     "user-1",
		PresenceStatus:  "editing",
		DraftVersion:    2,
		LeaseTtlSeconds: 120,
	}))
	if err != nil {
		t.Fatalf("UpsertCollaborationLease returned error: %v", err)
	}
	if got := claimed.Msg.GetSession().GetLockHolderUserId(); got != "user-1" {
		t.Fatalf("expected lock holder %q, got %q", "user-1", got)
	}

	_, err = contentClient.ReleaseCollaborationLease(ctx, connectrpc.NewRequest(&contentv1.ReleaseCollaborationLeaseRequest{
		OwnerType:   "shot",
		OwnerId:     firstShotResp.Msg.GetShot().GetId(),
		ActorUserId: "user-2",
	}))
	if err == nil {
		t.Fatalf("expected ReleaseCollaborationLease to reject non-holder release")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeFailedPrecondition {
		t.Fatalf("expected failed precondition, got %v", connectrpc.CodeOf(err))
	}

	released, err := contentClient.ReleaseCollaborationLease(ctx, connectrpc.NewRequest(&contentv1.ReleaseCollaborationLeaseRequest{
		OwnerType:   "shot",
		OwnerId:     firstShotResp.Msg.GetShot().GetId(),
		ActorUserId: "user-1",
	}))
	if err != nil {
		t.Fatalf("ReleaseCollaborationLease returned error: %v", err)
	}
	if got := released.Msg.GetSession().GetLockHolderUserId(); got != "" {
		t.Fatalf("expected released lock holder to be empty, got %q", got)
	}

	stream := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: content.collaboration.updated",
		`"owner_id":"`+firstShotResp.Msg.GetShot().GetId()+`"`,
		`"change_kind":"lease_claimed"`,
		`"change_kind":"lease_released"`,
	)
	if strings.Count(stream, "event: content.collaboration.updated") < 2 {
		t.Fatalf("expected at least 2 collaboration SSE events, got %q", stream)
	}

	_, err = contentClient.GetCollaborationSession(ctx, connectrpc.NewRequest(&contentv1.GetCollaborationSessionRequest{
		OwnerType: "shot",
	}))
	if err == nil {
		t.Fatalf("expected GetCollaborationSession to reject missing owner_id")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeInvalidArgument {
		t.Fatalf("expected invalid argument, got %v", connectrpc.CodeOf(err))
	}

	workbench, err := projectClient.GetPreviewWorkbench(ctx, connectrpc.NewRequest(&projectv1.GetPreviewWorkbenchRequest{
		ProjectId:     projectID,
		EpisodeId:     episodeID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("GetPreviewWorkbench returned error: %v", err)
	}
	if got := workbench.Msg.GetAssembly().GetProjectId(); got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}

	now := time.Now().UTC()
	assetID := store.GenerateMediaAssetID()
	if err := store.SaveMediaAsset(ctx, asset.MediaAsset{
		ID:            assetID,
		OrgID:         "org-1",
		ProjectID:     projectID,
		ImportBatchID: "batch-1",
		MediaType:     "image",
		SourceType:    "upload",
		Locale:        "zh-CN",
		RightsStatus:  "cleared",
		AIAnnotated:   true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}); err != nil {
		t.Fatalf("SaveMediaAsset returned error: %v", err)
	}
	shotExecutionID := store.GenerateShotExecutionID()
	if err := store.SaveShotExecution(ctx, execution.ShotExecution{
		ID:             shotExecutionID,
		OrgID:          "org-1",
		ProjectID:      projectID,
		ShotID:         firstShotResp.Msg.GetShot().GetId(),
		Status:         "ready",
		PrimaryAssetID: assetID,
		CurrentRunID:   "",
		CreatedAt:      now,
		UpdatedAt:      now,
	}); err != nil {
		t.Fatalf("SaveShotExecution returned error: %v", err)
	}
	firstRunID := store.GenerateShotExecutionRunID()
	if err := store.SaveShotExecutionRun(ctx, execution.ShotExecutionRun{
		ID:              firstRunID,
		ShotExecutionID: shotExecutionID,
		RunNumber:       1,
		Status:          "completed",
		TriggerType:     "retry",
		OperatorID:      "user-1",
		CreatedAt:       now,
		UpdatedAt:       now,
	}); err != nil {
		t.Fatalf("SaveShotExecutionRun #1 returned error: %v", err)
	}
	secondRunID := store.GenerateShotExecutionRunID()
	if err := store.SaveShotExecutionRun(ctx, execution.ShotExecutionRun{
		ID:              secondRunID,
		ShotExecutionID: shotExecutionID,
		RunNumber:       2,
		Status:          "completed",
		TriggerType:     "manual",
		OperatorID:      "user-1",
		CreatedAt:       now,
		UpdatedAt:       now,
	}); err != nil {
		t.Fatalf("SaveShotExecutionRun #2 returned error: %v", err)
	}

	updatedWorkbench, err := projectClient.UpsertPreviewAssembly(ctx, connectrpc.NewRequest(&projectv1.UpsertPreviewAssemblyRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
		Status:    "ready",
		Items: []*projectv1.PreviewAssemblyItem{
			{
				ShotId:         secondShotResp.Msg.GetShot().GetId(),
				PrimaryAssetId: "missing-asset",
				SourceRunId:    "missing-run",
				Sequence:       2,
			},
			{
				ShotId:         firstShotResp.Msg.GetShot().GetId(),
				PrimaryAssetId: assetID,
				SourceRunId:    secondRunID,
				Sequence:       1,
			},
		},
	}))
	if err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}
	if got := len(updatedWorkbench.Msg.GetAssembly().GetItems()); got != 2 {
		t.Fatalf("expected 2 preview items, got %d", got)
	}
	if got := updatedWorkbench.Msg.GetAssembly().GetItems()[0].GetShotId(); got != firstShotResp.Msg.GetShot().GetId() {
		t.Fatalf("expected first preview shot %q, got %q", firstShotResp.Msg.GetShot().GetId(), got)
	}
	if got := updatedWorkbench.Msg.GetAssembly().GetItems()[0].GetShot().GetProjectTitle(); got != "Phase 2 Foundation" {
		t.Fatalf("expected project title %q, got %q", "Phase 2 Foundation", got)
	}
	if got := updatedWorkbench.Msg.GetAssembly().GetItems()[0].GetPrimaryAsset().GetMediaType(); got != "image" {
		t.Fatalf("expected media type %q, got %q", "image", got)
	}
	if got := updatedWorkbench.Msg.GetAssembly().GetItems()[0].GetSourceRun().GetTriggerType(); got != "manual" {
		t.Fatalf("expected trigger type %q, got %q", "manual", got)
	}
	if updatedWorkbench.Msg.GetAssembly().GetItems()[1].GetPrimaryAsset() != nil {
		t.Fatalf("expected missing asset summary to stay nil")
	}
	if updatedWorkbench.Msg.GetAssembly().GetItems()[1].GetSourceRun() != nil {
		t.Fatalf("expected missing run summary to stay nil")
	}

	localizedWorkbench, err := projectClient.GetPreviewWorkbench(ctx, connectrpc.NewRequest(&projectv1.GetPreviewWorkbenchRequest{
		ProjectId:     projectID,
		EpisodeId:     episodeID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("localized GetPreviewWorkbench returned error: %v", err)
	}
	if got := localizedWorkbench.Msg.GetAssembly().GetItems()[0].GetShot().GetSceneTitle(); got != "Opening" {
		t.Fatalf("expected localized scene title %q, got %q", "Opening", got)
	}
	if got := localizedWorkbench.Msg.GetAssembly().GetItems()[0].GetShot().GetShotTitle(); got != "First shot localized" {
		t.Fatalf("expected localized shot title %q, got %q", "First shot localized", got)
	}

	shotOptions, err := projectClient.ListPreviewShotOptions(ctx, connectrpc.NewRequest(&projectv1.ListPreviewShotOptionsRequest{
		ProjectId:     projectID,
		EpisodeId:     episodeID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("ListPreviewShotOptions returned error: %v", err)
	}
	if got := len(shotOptions.Msg.GetOptions()); got != 2 {
		t.Fatalf("expected 2 shot options, got %d", got)
	}
	if got := shotOptions.Msg.GetOptions()[0].GetShotExecutionId(); got != shotExecutionID {
		t.Fatalf("expected shot execution id %q, got %q", shotExecutionID, got)
	}
	if got := shotOptions.Msg.GetOptions()[0].GetShot().GetSceneTitle(); got != "Opening" {
		t.Fatalf("expected localized scene title %q, got %q", "Opening", got)
	}
	if got := shotOptions.Msg.GetOptions()[0].GetShot().GetShotTitle(); got != "First shot localized" {
		t.Fatalf("expected localized shot title %q, got %q", "First shot localized", got)
	}
	if got := shotOptions.Msg.GetOptions()[0].GetCurrentPrimaryAsset().GetAssetId(); got != assetID {
		t.Fatalf("expected current primary asset %q, got %q", assetID, got)
	}
	if got := shotOptions.Msg.GetOptions()[0].GetLatestRun().GetRunId(); got != secondRunID {
		t.Fatalf("expected latest run id %q, got %q", secondRunID, got)
	}
	if shotOptions.Msg.GetOptions()[1].GetCurrentPrimaryAsset() != nil {
		t.Fatalf("expected shot without execution to keep asset summary nil")
	}

	projectScopedOptions, err := projectClient.ListPreviewShotOptions(ctx, connectrpc.NewRequest(&projectv1.ListPreviewShotOptionsRequest{
		ProjectId:     projectID,
		DisplayLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("project-scoped ListPreviewShotOptions returned error: %v", err)
	}
	if got := len(projectScopedOptions.Msg.GetOptions()); got != 2 {
		t.Fatalf("expected 2 project-scoped shot options, got %d", got)
	}

	_, err = projectClient.GetPreviewWorkbench(ctx, connectrpc.NewRequest(&projectv1.GetPreviewWorkbenchRequest{
		ProjectId: "missing-project",
	}))
	if err == nil {
		t.Fatalf("expected GetPreviewWorkbench to reject missing project")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeNotFound {
		t.Fatalf("expected not found, got %v", connectrpc.CodeOf(err))
	}
}
