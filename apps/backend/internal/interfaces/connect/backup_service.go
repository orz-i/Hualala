package connect

import (
	"context"

	connectrpc "connectrpc.com/connect"
	backupv1 "github.com/hualala/apps/backend/gen/hualala/backup/v1"
	backupv1connect "github.com/hualala/apps/backend/gen/hualala/backup/v1/backupv1connect"
	"github.com/hualala/apps/backend/internal/application/backupapp"
	"github.com/hualala/apps/backend/internal/platform/db"
)

type backupHandler struct {
	backupv1connect.UnimplementedBackupServiceHandler
	service *backupapp.Service
}

func (h *backupHandler) CreateBackupPackage(ctx context.Context, req *connectrpc.Request[backupv1.CreateBackupPackageRequest]) (*connectrpc.Response[backupv1.CreateBackupPackageResponse], error) {
	record, err := h.service.CreateBackupPackage(ctx, backupapp.CreateBackupPackageInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&backupv1.CreateBackupPackageResponse{
		BackupPackage: mapBackupPackage(record),
	}), nil
}

func (h *backupHandler) ListBackupPackages(ctx context.Context, req *connectrpc.Request[backupv1.ListBackupPackagesRequest]) (*connectrpc.Response[backupv1.ListBackupPackagesResponse], error) {
	records, err := h.service.ListBackupPackages(ctx, backupapp.ListBackupPackagesInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	items := make([]*backupv1.BackupPackage, 0, len(records))
	for _, record := range records {
		items = append(items, mapBackupPackage(record))
	}
	return connectrpc.NewResponse(&backupv1.ListBackupPackagesResponse{
		BackupPackages: items,
	}), nil
}

func (h *backupHandler) GetBackupPackage(ctx context.Context, req *connectrpc.Request[backupv1.GetBackupPackageRequest]) (*connectrpc.Response[backupv1.GetBackupPackageResponse], error) {
	record, err := h.service.GetBackupPackage(ctx, backupapp.GetBackupPackageInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
		PackageID:    req.Msg.GetPackageId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&backupv1.GetBackupPackageResponse{
		BackupPackage: mapBackupPackage(record.Package),
		PackageJson:   record.PackageJSON,
	}), nil
}

func (h *backupHandler) PreflightRestoreBackupPackage(ctx context.Context, req *connectrpc.Request[backupv1.PreflightRestoreBackupPackageRequest]) (*connectrpc.Response[backupv1.PreflightRestoreBackupPackageResponse], error) {
	record, err := h.service.PreflightRestoreBackupPackage(ctx, backupapp.PreflightRestoreBackupPackageInput{
		ActorOrgID:   req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:  req.Header().Get("X-Hualala-User-Id"),
		CookieHeader: req.Header().Get("Cookie"),
		OrgID:        req.Msg.GetOrgId(),
		PackageID:    req.Msg.GetPackageId(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&backupv1.PreflightRestoreBackupPackageResponse{
		PackageSummary: mapBackupSummary(record.PackageSummary),
		CurrentSummary: mapBackupSummary(record.CurrentSummary),
		Warnings:       record.Warnings,
		Destructive:    record.Destructive,
	}), nil
}

func (h *backupHandler) ApplyBackupPackage(ctx context.Context, req *connectrpc.Request[backupv1.ApplyBackupPackageRequest]) (*connectrpc.Response[backupv1.ApplyBackupPackageResponse], error) {
	record, err := h.service.ApplyBackupPackage(ctx, backupapp.ApplyBackupPackageInput{
		ActorOrgID:            req.Header().Get("X-Hualala-Org-Id"),
		ActorUserID:           req.Header().Get("X-Hualala-User-Id"),
		CookieHeader:          req.Header().Get("Cookie"),
		OrgID:                 req.Msg.GetOrgId(),
		PackageID:             req.Msg.GetPackageId(),
		ConfirmReplaceRuntime: req.Msg.GetConfirmReplaceRuntime(),
	})
	if err != nil {
		return nil, asConnectError(err)
	}
	return connectrpc.NewResponse(&backupv1.ApplyBackupPackageResponse{
		BackupPackage: mapBackupPackage(record),
	}), nil
}

func mapBackupPackage(record db.BackupPackageMetadata) *backupv1.BackupPackage {
	return &backupv1.BackupPackage{
		PackageId:       record.PackageID,
		SchemaVersion:   record.SchemaVersion,
		RestoreMode:     record.RestoreMode,
		CreatedAt:       timestampOrNil(record.CreatedAt),
		CreatedByUserId: record.CreatedByUserID,
		Summary: mapBackupSummary(db.BackupSummary{
			OrgIDs:       record.OrgIDs,
			ProjectIDs:   record.ProjectIDs,
			Counts:       record.Counts,
			PayloadBytes: record.PayloadBytes,
		}),
	}
}

func mapBackupSummary(record db.BackupSummary) *backupv1.BackupSummary {
	counts := make(map[string]int32, len(record.Counts))
	for key, value := range record.Counts {
		counts[key] = int32(value)
	}
	return &backupv1.BackupSummary{
		OrgIds:       append([]string(nil), record.OrgIDs...),
		ProjectIds:   append([]string(nil), record.ProjectIDs...),
		Counts:       counts,
		PayloadBytes: record.PayloadBytes,
	}
}
