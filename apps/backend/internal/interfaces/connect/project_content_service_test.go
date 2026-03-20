package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connectrpc "connectrpc.com/connect"
	contentv1 "github.com/hualala/apps/backend/gen/hualala/content/v1"
	contentv1connect "github.com/hualala/apps/backend/gen/hualala/content/v1/contentv1connect"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
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

	_, err = contentClient.CreateContentSnapshot(ctx, connectrpc.NewRequest(&contentv1.CreateContentSnapshotRequest{
		OwnerType:     "shot",
		OwnerId:       shotID,
		ContentLocale: "zh-CN",
		Body:          "主角推门进入客厅。",
	}))
	if err != nil {
		t.Fatalf("CreateContentSnapshot returned error: %v", err)
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
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err != nil {
		t.Fatalf("ListScenes returned error: %v", err)
	}
	if len(listScenesResp.Msg.GetScenes()) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(listScenesResp.Msg.GetScenes()))
	}

	getShotResp, err := contentClient.GetShot(ctx, connectrpc.NewRequest(&contentv1.GetShotRequest{
		ShotId: shotID,
	}))
	if err != nil {
		t.Fatalf("GetShot returned error: %v", err)
	}
	if got := getShotResp.Msg.GetShot().GetId(); got != shotID {
		t.Fatalf("expected shot %q, got %q", shotID, got)
	}
}
