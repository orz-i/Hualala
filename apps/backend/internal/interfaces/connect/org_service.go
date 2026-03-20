package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	orgv1 "github.com/hualala/apps/backend/gen/hualala/org/v1"
	orgv1connect "github.com/hualala/apps/backend/gen/hualala/org/v1/orgv1connect"
	"github.com/hualala/apps/backend/internal/application/orgapp"
)

type orgHandler struct {
	orgv1connect.UnimplementedOrgServiceHandler
	service *orgapp.Service
}

func (h *orgHandler) ListMembers(ctx context.Context, req *connectrpc.Request[orgv1.ListMembersRequest]) (*connectrpc.Response[orgv1.ListMembersResponse], error) {
	records, err := h.service.ListMembers(ctx, orgapp.ListMembersInput{
		ActorOrgID:  req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID: req.Header().Get("X-Hualala-User-Id"),
		OrgID:       req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*orgv1.Member, 0, len(records))
	for _, record := range records {
		items = append(items, mapOrgMember(record))
	}
	return connectrpc.NewResponse(&orgv1.ListMembersResponse{
		Members: items,
	}), nil
}

func (h *orgHandler) ListRoles(ctx context.Context, req *connectrpc.Request[orgv1.ListRolesRequest]) (*connectrpc.Response[orgv1.ListRolesResponse], error) {
	records, err := h.service.ListRoles(ctx, orgapp.ListRolesInput{
		ActorOrgID:  req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID: req.Header().Get("X-Hualala-User-Id"),
		OrgID:       req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*orgv1.Role, 0, len(records))
	for _, record := range records {
		items = append(items, mapOrgRole(record))
	}
	return connectrpc.NewResponse(&orgv1.ListRolesResponse{
		Roles: items,
	}), nil
}

func (h *orgHandler) UpdateMemberRole(ctx context.Context, req *connectrpc.Request[orgv1.UpdateMemberRoleRequest]) (*connectrpc.Response[orgv1.UpdateMemberRoleResponse], error) {
	record, err := h.service.UpdateMemberRole(ctx, orgapp.UpdateMemberRoleInput{
		ActorOrgID:  req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID: req.Header().Get("X-Hualala-User-Id"),
		OrgID:       req.Msg.GetOrgId(),
		MemberID:    req.Msg.GetMemberId(),
		RoleID:      req.Msg.GetRoleId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.UpdateMemberRoleResponse{
		Member: mapOrgMember(record),
	}), nil
}

func (h *orgHandler) UpdateOrgLocaleSettings(ctx context.Context, req *connectrpc.Request[orgv1.UpdateOrgLocaleSettingsRequest]) (*connectrpc.Response[orgv1.UpdateOrgLocaleSettingsResponse], error) {
	record, err := h.service.UpdateOrgLocaleSettings(ctx, orgapp.UpdateOrgLocaleSettingsInput{
		ActorOrgID:       req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:      req.Header().Get("X-Hualala-User-Id"),
		OrgID:            req.Msg.GetOrgId(),
		DefaultLocale:    req.Msg.GetDefaultLocale(),
		SupportedLocales: req.Msg.GetSupportedLocales(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.UpdateOrgLocaleSettingsResponse{
		LocaleSettings: mapOrgLocaleSettings(record),
	}), nil
}
