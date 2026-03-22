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
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
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
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
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

func (h *orgHandler) GetOrgLocaleSettings(ctx context.Context, req *connectrpc.Request[orgv1.GetOrgLocaleSettingsRequest]) (*connectrpc.Response[orgv1.GetOrgLocaleSettingsResponse], error) {
	record, err := h.service.GetOrgLocaleSettings(ctx, orgapp.GetOrgLocaleSettingsInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.GetOrgLocaleSettingsResponse{
		LocaleSettings: mapOrgLocaleSettings(record),
	}), nil
}

func (h *orgHandler) ListAvailablePermissions(ctx context.Context, req *connectrpc.Request[orgv1.ListAvailablePermissionsRequest]) (*connectrpc.Response[orgv1.ListAvailablePermissionsResponse], error) {
	records, err := h.service.ListAvailablePermissions(ctx, orgapp.ListAvailablePermissionsInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*orgv1.AvailablePermission, 0, len(records))
	for _, record := range records {
		items = append(items, mapAvailablePermission(record))
	}
	return connectrpc.NewResponse(&orgv1.ListAvailablePermissionsResponse{
		Permissions: items,
	}), nil
}

func (h *orgHandler) CreateRole(ctx context.Context, req *connectrpc.Request[orgv1.CreateRoleRequest]) (*connectrpc.Response[orgv1.CreateRoleResponse], error) {
	record, err := h.service.CreateRole(ctx, orgapp.CreateRoleInput{
		ActorOrgID:      req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:     req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:    req.Header().Get("Cookie"),
		OrgID:           req.Msg.GetOrgId(),
		Code:            req.Msg.GetCode(),
		DisplayName:     req.Msg.GetDisplayName(),
		PermissionCodes: req.Msg.GetPermissionCodes(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.CreateRoleResponse{
		Role: mapOrgRole(record),
	}), nil
}

func (h *orgHandler) UpdateRole(ctx context.Context, req *connectrpc.Request[orgv1.UpdateRoleRequest]) (*connectrpc.Response[orgv1.UpdateRoleResponse], error) {
	record, err := h.service.UpdateRole(ctx, orgapp.UpdateRoleInput{
		ActorOrgID:      req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:     req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:    req.Header().Get("Cookie"),
		OrgID:           req.Msg.GetOrgId(),
		RoleID:          req.Msg.GetRoleId(),
		DisplayName:     req.Msg.GetDisplayName(),
		PermissionCodes: req.Msg.GetPermissionCodes(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.UpdateRoleResponse{
		Role: mapOrgRole(record),
	}), nil
}

func (h *orgHandler) DeleteRole(ctx context.Context, req *connectrpc.Request[orgv1.DeleteRoleRequest]) (*connectrpc.Response[orgv1.DeleteRoleResponse], error) {
	if err := h.service.DeleteRole(ctx, orgapp.DeleteRoleInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
		RoleID:       req.Msg.GetRoleId(),
	}); err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&orgv1.DeleteRoleResponse{}), nil
}

func (h *orgHandler) UpdateMemberRole(ctx context.Context, req *connectrpc.Request[orgv1.UpdateMemberRoleRequest]) (*connectrpc.Response[orgv1.UpdateMemberRoleResponse], error) {
	record, err := h.service.UpdateMemberRole(ctx, orgapp.UpdateMemberRoleInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
		MemberID:     req.Msg.GetMemberId(),
		RoleID:       req.Msg.GetRoleId(),
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
		CookieHeader:     req.Header().Get("Cookie"),
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
