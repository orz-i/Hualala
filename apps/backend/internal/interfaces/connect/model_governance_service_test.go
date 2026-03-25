package connect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connectrpc "connectrpc.com/connect"
	modelv1 "github.com/hualala/apps/backend/gen/hualala/model/v1"
	modelv1connect "github.com/hualala/apps/backend/gen/hualala/model/v1/modelv1connect"
	"github.com/hualala/apps/backend/internal/domain/modelgovernance"
	"github.com/hualala/apps/backend/internal/platform/db"
	"github.com/hualala/apps/backend/internal/platform/runtime"
)

func TestModelGovernanceServiceListsProfilesTemplatesAndContextBundles(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	seedConnectAuthStore(store)

	if err := store.SaveModelProfile(ctx, modelgovernance.ModelProfile{
		ID:                    "11111111-1111-1111-1111-111111111111",
		OrganizationID:        connectTestOrgID,
		Provider:              "openai",
		ModelName:             "gpt-image-1",
		CapabilityType:        "image",
		Region:                "global",
		SupportedInputLocales: []string{"zh-CN", "en-US"},
		SupportedOutputLocales: []string{
			"zh-CN",
			"en-US",
		},
		PricingSnapshotJSON: `{"input":"0.01"}`,
		RateLimitPolicyJSON: `{"rpm":60}`,
		Status:              "active",
	}); err != nil {
		t.Fatalf("SaveModelProfile returned error: %v", err)
	}

	if err := store.SavePromptTemplate(ctx, modelgovernance.PromptTemplate{
		ID:               "22222222-2222-2222-2222-222222222222",
		OrganizationID:   connectTestOrgID,
		TemplateFamily:   "shot.generate",
		TemplateKey:      "shot.generate.default",
		Locale:           "zh-CN",
		Version:          1,
		Content:          "生成镜头提示词",
		InputSchemaJSON:  `{"type":"object"}`,
		OutputSchemaJSON: `{"type":"object"}`,
		Status:           "active",
	}); err != nil {
		t.Fatalf("SavePromptTemplate returned error: %v", err)
	}

	if err := store.SaveContextBundle(ctx, modelgovernance.ContextBundle{
		ID:                    "33333333-3333-3333-3333-333333333333",
		OrganizationID:        connectTestOrgID,
		ProjectID:             "44444444-4444-4444-4444-444444444444",
		ShotID:                "55555555-5555-5555-5555-555555555555",
		ModelProfileID:        "11111111-1111-1111-1111-111111111111",
		PromptTemplateID:      "22222222-2222-2222-2222-222222222222",
		InputLocale:           "zh-CN",
		OutputLocale:          "en-US",
		ResolvedPromptVersion: 1,
		SourceSnapshotIDs: []string{
			"66666666-6666-6666-6666-666666666666",
		},
		ReferencedAssetIDs: []string{
			"77777777-7777-7777-7777-777777777777",
		},
		PayloadJSON:     `{"temperature":0.2}`,
		CreatedByUserID: connectTestUserID,
	}); err != nil {
		t.Fatalf("SaveContextBundle returned error: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	client := modelv1connect.NewModelGovernanceServiceClient(server.Client(), server.URL)

	profilesReq := connectrpc.NewRequest(&modelv1.ListModelProfilesRequest{})
	profilesReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	profilesReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	profilesResp, err := client.ListModelProfiles(ctx, profilesReq)
	if err != nil {
		t.Fatalf("ListModelProfiles returned error: %v", err)
	}
	if got := len(profilesResp.Msg.GetModelProfiles()); got != 1 {
		t.Fatalf("expected 1 model profile, got %d", got)
	}

	templatesReq := connectrpc.NewRequest(&modelv1.ListPromptTemplatesRequest{
		TemplateKey: "shot.generate.default",
	})
	templatesReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	templatesReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	templatesResp, err := client.ListPromptTemplates(ctx, templatesReq)
	if err != nil {
		t.Fatalf("ListPromptTemplates returned error: %v", err)
	}
	if got := len(templatesResp.Msg.GetPromptTemplates()); got != 1 {
		t.Fatalf("expected 1 prompt template, got %d", got)
	}

	contextBundlesReq := connectrpc.NewRequest(&modelv1.ListContextBundlesRequest{
		ProjectId: "44444444-4444-4444-4444-444444444444",
		ShotId:    "55555555-5555-5555-5555-555555555555",
	})
	contextBundlesReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	contextBundlesReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	contextBundlesResp, err := client.ListContextBundles(ctx, contextBundlesReq)
	if err != nil {
		t.Fatalf("ListContextBundles returned error: %v", err)
	}
	if got := len(contextBundlesResp.Msg.GetContextBundles()); got != 1 {
		t.Fatalf("expected 1 context bundle, got %d", got)
	}

	contextBundleReq := connectrpc.NewRequest(&modelv1.GetContextBundleRequest{
		ContextBundleId: "33333333-3333-3333-3333-333333333333",
	})
	contextBundleReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	contextBundleReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	contextBundleResp, err := client.GetContextBundle(ctx, contextBundleReq)
	if err != nil {
		t.Fatalf("GetContextBundle returned error: %v", err)
	}
	if got := contextBundleResp.Msg.GetContextBundle().GetPayloadJson(); got != `{"temperature":0.2}` {
		t.Fatalf("expected context bundle payload json, got %q", got)
	}
}

func TestModelGovernanceServiceMutatesProfilesAndPromptTemplates(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	seedConnectAuthStore(store)

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	client := modelv1connect.NewModelGovernanceServiceClient(server.Client(), server.URL)

	createProfileReq := connectrpc.NewRequest(&modelv1.CreateModelProfileRequest{
		Provider:               "openai",
		ModelName:              "gpt-4.1",
		CapabilityType:         "text",
		Region:                 "global",
		SupportedInputLocales:  []string{"zh-CN"},
		SupportedOutputLocales: []string{"zh-CN", "en-US"},
		PricingSnapshotJson:    `{"input":"0.001"}`,
		RateLimitPolicyJson:    `{"rpm":120}`,
	})
	createProfileReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	createProfileReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	createProfileResp, err := client.CreateModelProfile(ctx, createProfileReq)
	if err != nil {
		t.Fatalf("CreateModelProfile returned error: %v", err)
	}

	profileID := createProfileResp.Msg.GetModelProfile().GetId()
	if profileID == "" {
		t.Fatalf("expected model profile id")
	}

	updateProfileReq := connectrpc.NewRequest(&modelv1.UpdateModelProfileRequest{
		ModelProfileId:         profileID,
		SupportedInputLocales:  []string{"zh-CN", "en-US"},
		SupportedOutputLocales: []string{"en-US"},
		PricingSnapshotJson:    `{"input":"0.002"}`,
		RateLimitPolicyJson:    `{"rpm":80}`,
	})
	updateProfileReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	updateProfileReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	updateProfileResp, err := client.UpdateModelProfile(ctx, updateProfileReq)
	if err != nil {
		t.Fatalf("UpdateModelProfile returned error: %v", err)
	}
	if got := updateProfileResp.Msg.GetModelProfile().GetPricingSnapshotJson(); got != `{"input":"0.002"}` {
		t.Fatalf("expected updated pricing snapshot, got %q", got)
	}

	statusProfileReq := connectrpc.NewRequest(&modelv1.SetModelProfileStatusRequest{
		ModelProfileId: profileID,
		Status:         "paused",
	})
	statusProfileReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	statusProfileReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	statusProfileResp, err := client.SetModelProfileStatus(ctx, statusProfileReq)
	if err != nil {
		t.Fatalf("SetModelProfileStatus returned error: %v", err)
	}
	if got := statusProfileResp.Msg.GetModelProfile().GetStatus(); got != "paused" {
		t.Fatalf("expected paused model profile, got %q", got)
	}
	pausedProfilesReq := connectrpc.NewRequest(&modelv1.ListModelProfilesRequest{Status: "paused"})
	pausedProfilesReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	pausedProfilesReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	pausedProfilesResp, err := client.ListModelProfiles(ctx, pausedProfilesReq)
	if err != nil {
		t.Fatalf("ListModelProfiles paused filter returned error: %v", err)
	}
	if got := len(pausedProfilesResp.Msg.GetModelProfiles()); got != 1 {
		t.Fatalf("expected 1 paused model profile, got %d", got)
	}

	createPromptReq := connectrpc.NewRequest(&modelv1.CreatePromptTemplateVersionRequest{
		TemplateFamily:   "shot.generate",
		TemplateKey:      "shot.generate.default",
		Locale:           "zh-CN",
		Content:          "第一版提示词",
		InputSchemaJson:  `{"type":"object"}`,
		OutputSchemaJson: `{"type":"object"}`,
	})
	createPromptReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	createPromptReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	createPromptResp, err := client.CreatePromptTemplateVersion(ctx, createPromptReq)
	if err != nil {
		t.Fatalf("CreatePromptTemplateVersion returned error: %v", err)
	}

	templateID := createPromptResp.Msg.GetPromptTemplate().GetId()
	if templateID == "" {
		t.Fatalf("expected prompt template id")
	}
	if got := createPromptResp.Msg.GetPromptTemplate().GetStatus(); got != "draft" {
		t.Fatalf("expected draft prompt template, got %q", got)
	}

	updatePromptReq := connectrpc.NewRequest(&modelv1.UpdatePromptTemplateDraftRequest{
		PromptTemplateId: templateID,
		Content:          "修订后的提示词",
		InputSchemaJson:  `{"type":"object","required":["goal"]}`,
		OutputSchemaJson: `{"type":"object"}`,
	})
	updatePromptReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	updatePromptReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	updatePromptResp, err := client.UpdatePromptTemplateDraft(ctx, updatePromptReq)
	if err != nil {
		t.Fatalf("UpdatePromptTemplateDraft returned error: %v", err)
	}
	if got := updatePromptResp.Msg.GetPromptTemplate().GetContent(); got != "修订后的提示词" {
		t.Fatalf("expected updated draft content, got %q", got)
	}

	statusPromptReq := connectrpc.NewRequest(&modelv1.SetPromptTemplateStatusRequest{
		PromptTemplateId: templateID,
		Status:           "active",
	})
	statusPromptReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	statusPromptReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	statusPromptResp, err := client.SetPromptTemplateStatus(ctx, statusPromptReq)
	if err != nil {
		t.Fatalf("SetPromptTemplateStatus returned error: %v", err)
	}
	if got := statusPromptResp.Msg.GetPromptTemplate().GetStatus(); got != "active" {
		t.Fatalf("expected active prompt template, got %q", got)
	}

	rejectedUpdateReq := connectrpc.NewRequest(&modelv1.UpdatePromptTemplateDraftRequest{
		PromptTemplateId: templateID,
		Content:          "不允许修改 active 版本",
		InputSchemaJson:  `{"type":"object"}`,
		OutputSchemaJson: `{"type":"object"}`,
	})
	rejectedUpdateReq.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	rejectedUpdateReq.Header().Set("X-Hualala-User-Id", connectTestUserID)
	if _, err := client.UpdatePromptTemplateDraft(ctx, rejectedUpdateReq); err == nil {
		t.Fatalf("expected updating an active prompt draft to fail")
	}
}

func TestModelGovernanceServiceRejectsWriteWithoutPermission(t *testing.T) {
	ctx := context.Background()
	store := db.NewMemoryStore()
	seedConnectAuthStore(store)
	store.RolePermissions["connect-test-role"] = []string{"org.model_governance.read"}

	mux := http.NewServeMux()
	RegisterRoutes(mux, NewRouteDependencies(runtime.NewFactory(store).Services()))
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	client := modelv1connect.NewModelGovernanceServiceClient(server.Client(), server.URL)
	req := connectrpc.NewRequest(&modelv1.CreateModelProfileRequest{
		Provider:               "openai",
		ModelName:              "gpt-4.1",
		CapabilityType:         "text",
		SupportedInputLocales:  []string{"zh-CN"},
		SupportedOutputLocales: []string{"en-US"},
	})
	req.Header().Set("X-Hualala-Org-Id", connectTestOrgID)
	req.Header().Set("X-Hualala-User-Id", connectTestUserID)

	if _, err := client.CreateModelProfile(ctx, req); err == nil {
		t.Fatalf("expected CreateModelProfile to reject missing write permission")
	}
}
