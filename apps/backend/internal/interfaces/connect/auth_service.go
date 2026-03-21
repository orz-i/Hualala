package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	authv1 "github.com/hualala/apps/backend/gen/hualala/auth/v1"
	authv1connect "github.com/hualala/apps/backend/gen/hualala/auth/v1/authv1connect"
	"github.com/hualala/apps/backend/internal/application/authapp"
	"github.com/hualala/apps/backend/internal/platform/authsession"
)

type authHandler struct {
	authv1connect.UnimplementedAuthServiceHandler
	service *authapp.Service
}

func (h *authHandler) GetCurrentSession(ctx context.Context, req *connectrpc.Request[authv1.GetCurrentSessionRequest]) (*connectrpc.Response[authv1.GetCurrentSessionResponse], error) {
	record, err := h.service.GetCurrentSession(ctx, authapp.GetCurrentSessionInput{
		HeaderOrgID:  req.Header().Get("X-Hualala-Org-Id"),
		HeaderUserID: req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&authv1.GetCurrentSessionResponse{
		Session: mapSession(record),
	}), nil
}

func (h *authHandler) StartDevSession(ctx context.Context, _ *connectrpc.Request[authv1.StartDevSessionRequest]) (*connectrpc.Response[authv1.StartDevSessionResponse], error) {
	record, err := h.service.StartDevSession(ctx)
	if err != nil {
		return nil, asConnectError(err)
	}
	resp := connectrpc.NewResponse(&authv1.StartDevSessionResponse{
		Session: mapSession(record),
	})
	authsession.SetDevSessionCookies(resp.Header(), record.OrgID, record.UserID)
	return resp, nil
}

func (h *authHandler) RefreshSession(ctx context.Context, req *connectrpc.Request[authv1.RefreshSessionRequest]) (*connectrpc.Response[authv1.RefreshSessionResponse], error) {
	record, err := h.service.RefreshSession(ctx, authapp.RefreshSessionInput{
		HeaderOrgID:  req.Header().Get("X-Hualala-Org-Id"),
		HeaderUserID: req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		RefreshToken: req.Msg.GetRefreshToken(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	resp := connectrpc.NewResponse(&authv1.RefreshSessionResponse{
		Session: mapSession(record),
	})
	authsession.SetDevSessionCookies(resp.Header(), record.OrgID, record.UserID)
	return resp, nil
}

func (h *authHandler) ClearCurrentSession(ctx context.Context, _ *connectrpc.Request[authv1.ClearCurrentSessionRequest]) (*connectrpc.Response[authv1.ClearCurrentSessionResponse], error) {
	if err := h.service.ClearCurrentSession(ctx); err != nil {
		return nil, asConnectError(err)
	}
	resp := connectrpc.NewResponse(&authv1.ClearCurrentSessionResponse{})
	authsession.ClearDevSessionCookies(resp.Header())
	return resp, nil
}

func (h *authHandler) UpdateUserPreferences(ctx context.Context, req *connectrpc.Request[authv1.UpdateUserPreferencesRequest]) (*connectrpc.Response[authv1.UpdateUserPreferencesResponse], error) {
	record, err := h.service.UpdateUserPreferences(ctx, authapp.UpdateUserPreferencesInput{
		ActorOrgID:    req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:   req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:  req.Header().Get("Cookie"),
		UserID:        req.Msg.GetUserId(),
		DisplayLocale: req.Msg.GetDisplayLocale(),
		Timezone:      req.Msg.GetTimezone(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&authv1.UpdateUserPreferencesResponse{
		Preferences: mapUserPreferences(record),
	}), nil
}
