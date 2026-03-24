package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	contentv1 "github.com/hualala/apps/backend/gen/hualala/content/v1"
	contentv1connect "github.com/hualala/apps/backend/gen/hualala/content/v1/contentv1connect"
	projectv1 "github.com/hualala/apps/backend/gen/hualala/project/v1"
	projectv1connect "github.com/hualala/apps/backend/gen/hualala/project/v1/projectv1connect"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestPreviewRuntimeRoutesExposeQueuedRuntimeAndSSE(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()

	mux := http.NewServeMux()
	RegisterRoutes(mux, newRouteDependenciesFromStore(store))
	server := httptest.NewServer(mux)
	defer server.Close()

	projectClient := projectv1connect.NewProjectServiceClient(server.Client(), server.URL)
	contentClient := contentv1connect.NewContentServiceClient(server.Client(), server.URL)

	projectResp, err := projectClient.CreateProject(ctx, connectrpc.NewRequest(&projectv1.CreateProjectRequest{
		OrgId:       connectTestOrgID,
		Title:       "Preview Runtime",
		OwnerUserId: connectTestUserID,
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
	shotResp, err := contentClient.CreateShot(ctx, connectrpc.NewRequest(&contentv1.CreateShotRequest{
		SceneId:    sceneResp.Msg.GetScene().GetId(),
		ShotNumber: 1,
		Title:      "第一镜",
	}))
	if err != nil {
		t.Fatalf("CreateShot returned error: %v", err)
	}
	shotID := shotResp.Msg.GetShot().GetId()

	initial, err := projectClient.GetPreviewRuntime(ctx, connectrpc.NewRequest(&projectv1.GetPreviewRuntimeRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
	}))
	if err != nil {
		t.Fatalf("GetPreviewRuntime returned error: %v", err)
	}
	if got := initial.Msg.GetRuntime().GetProjectId(); got != projectID {
		t.Fatalf("expected project %q, got %q", projectID, got)
	}
	if got := initial.Msg.GetRuntime().GetRenderStatus(); got != "idle" {
		t.Fatalf("expected initial render_status %q, got %q", "idle", got)
	}

	if _, err := projectClient.UpsertPreviewAssembly(ctx, connectrpc.NewRequest(&projectv1.UpsertPreviewAssemblyRequest{
		ProjectId: projectID,
		EpisodeId: episodeID,
		Status:    "ready",
		Items: []*projectv1.PreviewAssemblyItem{
			{
				ShotId:   shotID,
				Sequence: 1,
			},
		},
	})); err != nil {
		t.Fatalf("UpsertPreviewAssembly returned error: %v", err)
	}

	sseCtx, cancelSSE := context.WithTimeout(ctx, 2*time.Second)
	defer cancelSSE()
	sseReq, err := http.NewRequestWithContext(sseCtx, http.MethodGet, server.URL+"/sse/events?organization_id="+connectTestOrgID+"&project_id="+projectID, nil)
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

	queued, err := projectClient.RequestPreviewRender(ctx, connectrpc.NewRequest(&projectv1.RequestPreviewRenderRequest{
		ProjectId:       projectID,
		EpisodeId:       episodeID,
		RequestedLocale: "en-US",
	}))
	if err != nil {
		t.Fatalf("RequestPreviewRender returned error: %v", err)
	}
	if got := queued.Msg.GetRuntime().GetRenderStatus(); got != "queued" {
		t.Fatalf("expected queued render status %q, got %q", "queued", got)
	}
	if got := queued.Msg.GetRuntime().GetResolvedLocale(); got != "en-US" {
		t.Fatalf("expected resolved locale %q, got %q", "en-US", got)
	}
	if got := queued.Msg.GetRuntime().GetRenderWorkflowRunId(); got == "" {
		t.Fatalf("expected render workflow run id to be populated")
	}

	stream := readEventStreamUntil(t, sseResp.Body, cancelSSE,
		"event: project.preview.runtime.updated",
		`"preview_runtime_id":"`+queued.Msg.GetRuntime().GetPreviewRuntimeId()+`"`,
		`"render_status":"queued"`,
		`"resolved_locale":"en-US"`,
	)
	if stream == "" {
		t.Fatalf("expected preview runtime SSE payload")
	}

	_, err = projectClient.RequestPreviewRender(ctx, connectrpc.NewRequest(&projectv1.RequestPreviewRenderRequest{
		ProjectId:       projectID,
		EpisodeId:       episodeID,
		RequestedLocale: "zh-CN",
	}))
	if err == nil {
		t.Fatalf("expected duplicate RequestPreviewRender to fail")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeFailedPrecondition {
		t.Fatalf("expected failed precondition, got %v", connectrpc.CodeOf(err))
	}
}
