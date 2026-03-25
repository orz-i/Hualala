package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	modelv1 "github.com/hualala/apps/backend/gen/hualala/model/v1"
	modelv1connect "github.com/hualala/apps/backend/gen/hualala/model/v1/modelv1connect"
	"github.com/hualala/apps/backend/internal/application/modelgovernanceapp"
)

type modelGovernanceHandler struct {
	modelv1connect.UnimplementedModelGovernanceServiceHandler
	service *modelgovernanceapp.Service
}

func (h *modelGovernanceHandler) ListModelProfiles(ctx context.Context, req *connectrpc.Request[modelv1.ListModelProfilesRequest]) (*connectrpc.Response[modelv1.ListModelProfilesResponse], error) {
	records, err := h.service.ListModelProfiles(ctx, modelgovernanceapp.ListModelProfilesInput{
		ActorOrgID:     req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:    req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:   req.Header().Get("Cookie"),
		OrgID:          req.Msg.GetOrgId(),
		CapabilityType: req.Msg.GetCapabilityType(),
		Status:         req.Msg.GetStatus(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*modelv1.ModelProfile, 0, len(records))
	for _, record := range records {
		items = append(items, mapModelProfile(record))
	}
	return connectrpc.NewResponse(&modelv1.ListModelProfilesResponse{ModelProfiles: items}), nil
}

func (h *modelGovernanceHandler) CreateModelProfile(ctx context.Context, req *connectrpc.Request[modelv1.CreateModelProfileRequest]) (*connectrpc.Response[modelv1.CreateModelProfileResponse], error) {
	record, err := h.service.CreateModelProfile(ctx, modelgovernanceapp.CreateModelProfileInput{
		ActorOrgID:             req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:            req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:           req.Header().Get("Cookie"),
		OrgID:                  req.Msg.GetOrgId(),
		Provider:               req.Msg.GetProvider(),
		ModelName:              req.Msg.GetModelName(),
		CapabilityType:         req.Msg.GetCapabilityType(),
		Region:                 req.Msg.GetRegion(),
		SupportedInputLocales:  req.Msg.GetSupportedInputLocales(),
		SupportedOutputLocales: req.Msg.GetSupportedOutputLocales(),
		PricingSnapshotJSON:    req.Msg.GetPricingSnapshotJson(),
		RateLimitPolicyJSON:    req.Msg.GetRateLimitPolicyJson(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.CreateModelProfileResponse{ModelProfile: mapModelProfile(record)}), nil
}

func (h *modelGovernanceHandler) UpdateModelProfile(ctx context.Context, req *connectrpc.Request[modelv1.UpdateModelProfileRequest]) (*connectrpc.Response[modelv1.UpdateModelProfileResponse], error) {
	record, err := h.service.UpdateModelProfile(ctx, modelgovernanceapp.UpdateModelProfileInput{
		ActorOrgID:             req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:            req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:           req.Header().Get("Cookie"),
		OrgID:                  req.Msg.GetOrgId(),
		ModelProfileID:         req.Msg.GetModelProfileId(),
		SupportedInputLocales:  req.Msg.GetSupportedInputLocales(),
		SupportedOutputLocales: req.Msg.GetSupportedOutputLocales(),
		PricingSnapshotJSON:    req.Msg.GetPricingSnapshotJson(),
		RateLimitPolicyJSON:    req.Msg.GetRateLimitPolicyJson(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.UpdateModelProfileResponse{ModelProfile: mapModelProfile(record)}), nil
}

func (h *modelGovernanceHandler) SetModelProfileStatus(ctx context.Context, req *connectrpc.Request[modelv1.SetModelProfileStatusRequest]) (*connectrpc.Response[modelv1.SetModelProfileStatusResponse], error) {
	record, err := h.service.SetModelProfileStatus(ctx, modelgovernanceapp.SetModelProfileStatusInput{
		ActorOrgID:     req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:    req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:   req.Header().Get("Cookie"),
		OrgID:          req.Msg.GetOrgId(),
		ModelProfileID: req.Msg.GetModelProfileId(),
		Status:         req.Msg.GetStatus(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.SetModelProfileStatusResponse{ModelProfile: mapModelProfile(record)}), nil
}

func (h *modelGovernanceHandler) ListPromptTemplates(ctx context.Context, req *connectrpc.Request[modelv1.ListPromptTemplatesRequest]) (*connectrpc.Response[modelv1.ListPromptTemplatesResponse], error) {
	records, err := h.service.ListPromptTemplates(ctx, modelgovernanceapp.ListPromptTemplatesInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
		TemplateKey:  req.Msg.GetTemplateKey(),
		Locale:       req.Msg.GetLocale(),
		Status:       req.Msg.GetStatus(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*modelv1.PromptTemplate, 0, len(records))
	for _, record := range records {
		items = append(items, mapPromptTemplate(record))
	}
	return connectrpc.NewResponse(&modelv1.ListPromptTemplatesResponse{PromptTemplates: items}), nil
}

func (h *modelGovernanceHandler) GetPromptTemplate(ctx context.Context, req *connectrpc.Request[modelv1.GetPromptTemplateRequest]) (*connectrpc.Response[modelv1.GetPromptTemplateResponse], error) {
	record, err := h.service.GetPromptTemplate(ctx, modelgovernanceapp.GetPromptTemplateInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:     req.Header().Get("Cookie"),
		OrgID:            req.Msg.GetOrgId(),
		PromptTemplateID: req.Msg.GetPromptTemplateId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.GetPromptTemplateResponse{PromptTemplate: mapPromptTemplate(record)}), nil
}

func (h *modelGovernanceHandler) CreatePromptTemplateVersion(ctx context.Context, req *connectrpc.Request[modelv1.CreatePromptTemplateVersionRequest]) (*connectrpc.Response[modelv1.CreatePromptTemplateVersionResponse], error) {
	record, err := h.service.CreatePromptTemplateVersion(ctx, modelgovernanceapp.CreatePromptTemplateVersionInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:     req.Header().Get("Cookie"),
		OrgID:            req.Msg.GetOrgId(),
		TemplateFamily:   req.Msg.GetTemplateFamily(),
		TemplateKey:      req.Msg.GetTemplateKey(),
		Locale:           req.Msg.GetLocale(),
		Content:          req.Msg.GetContent(),
		InputSchemaJSON:  req.Msg.GetInputSchemaJson(),
		OutputSchemaJSON: req.Msg.GetOutputSchemaJson(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.CreatePromptTemplateVersionResponse{PromptTemplate: mapPromptTemplate(record)}), nil
}

func (h *modelGovernanceHandler) UpdatePromptTemplateDraft(ctx context.Context, req *connectrpc.Request[modelv1.UpdatePromptTemplateDraftRequest]) (*connectrpc.Response[modelv1.UpdatePromptTemplateDraftResponse], error) {
	record, err := h.service.UpdatePromptTemplateDraft(ctx, modelgovernanceapp.UpdatePromptTemplateDraftInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:     req.Header().Get("Cookie"),
		OrgID:            req.Msg.GetOrgId(),
		PromptTemplateID: req.Msg.GetPromptTemplateId(),
		Content:          req.Msg.GetContent(),
		InputSchemaJSON:  req.Msg.GetInputSchemaJson(),
		OutputSchemaJSON: req.Msg.GetOutputSchemaJson(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.UpdatePromptTemplateDraftResponse{PromptTemplate: mapPromptTemplate(record)}), nil
}

func (h *modelGovernanceHandler) SetPromptTemplateStatus(ctx context.Context, req *connectrpc.Request[modelv1.SetPromptTemplateStatusRequest]) (*connectrpc.Response[modelv1.SetPromptTemplateStatusResponse], error) {
	record, err := h.service.SetPromptTemplateStatus(ctx, modelgovernanceapp.SetPromptTemplateStatusInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:     req.Header().Get("Cookie"),
		OrgID:            req.Msg.GetOrgId(),
		PromptTemplateID: req.Msg.GetPromptTemplateId(),
		Status:           req.Msg.GetStatus(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.SetPromptTemplateStatusResponse{PromptTemplate: mapPromptTemplate(record)}), nil
}

func (h *modelGovernanceHandler) ListContextBundles(ctx context.Context, req *connectrpc.Request[modelv1.ListContextBundlesRequest]) (*connectrpc.Response[modelv1.ListContextBundlesResponse], error) {
	records, err := h.service.ListContextBundles(ctx, modelgovernanceapp.ListContextBundlesInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:     req.Header().Get("Cookie"),
		OrgID:            req.Msg.GetOrgId(),
		ProjectID:        req.Msg.GetProjectId(),
		ShotID:           req.Msg.GetShotId(),
		ShotExecutionID:  req.Msg.GetShotExecutionId(),
		ModelProfileID:   req.Msg.GetModelProfileId(),
		PromptTemplateID: req.Msg.GetPromptTemplateId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*modelv1.ContextBundle, 0, len(records))
	for _, record := range records {
		items = append(items, mapContextBundle(record))
	}
	return connectrpc.NewResponse(&modelv1.ListContextBundlesResponse{ContextBundles: items}), nil
}

func (h *modelGovernanceHandler) GetContextBundle(ctx context.Context, req *connectrpc.Request[modelv1.GetContextBundleRequest]) (*connectrpc.Response[modelv1.GetContextBundleResponse], error) {
	record, err := h.service.GetContextBundle(ctx, modelgovernanceapp.GetContextBundleInput{
		ActorOrgID:      req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:     req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:    req.Header().Get("Cookie"),
		OrgID:           req.Msg.GetOrgId(),
		ContextBundleID: req.Msg.GetContextBundleId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&modelv1.GetContextBundleResponse{ContextBundle: mapContextBundle(record)}), nil
}
