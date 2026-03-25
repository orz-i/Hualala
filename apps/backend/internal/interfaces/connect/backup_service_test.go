package connect

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	connectrpc "connectrpc.com/connect"
	backupv1 "github.com/hualala/apps/backend/gen/hualala/backup/v1"
	backupv1connect "github.com/hualala/apps/backend/gen/hualala/backup/v1/backupv1connect"
	"github.com/hualala/apps/backend/internal/application/backupapp"
	authdomain "github.com/hualala/apps/backend/internal/domain/auth"
	gatewaydomain "github.com/hualala/apps/backend/internal/domain/gateway"
	orgdomain "github.com/hualala/apps/backend/internal/domain/org"
	projectdomain "github.com/hualala/apps/backend/internal/domain/project"
	workflowdomain "github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/authsession"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestBackupRoutesLifecycle(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC)
	currentSnapshot := db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID, Slug: "dev-org", DisplayName: "Development Organization"},
		},
		Projects: map[string]projectdomain.Project{
			"project-1": {
				ID:                   "project-1",
				OrganizationID:       db.DefaultDevOrganizationID,
				OwnerUserID:          db.DefaultDevUserID,
				Title:                "Project 1",
				Status:               "draft",
				CurrentStage:         "planning",
				PrimaryContentLocale: "zh-CN",
			},
		},
		WorkflowRuns: map[string]workflowdomain.WorkflowRun{
			"workflow-run-1": {
				ID:           "workflow-run-1",
				OrgID:        db.DefaultDevOrganizationID,
				ProjectID:    "project-1",
				WorkflowType: "shot_execution",
				ResourceID:   "project-1",
				Status:       workflowdomain.StatusRunning,
			},
		},
		GatewayResults: map[string]gatewaydomain.GatewayResult{
			"idem-1": {Provider: "seedance", ExternalRequestID: "external-1"},
		},
	}
	record := mustBuildConnectBackupRecord(t, "package-1", currentSnapshot, now)
	repo := &connectFakeBackupRepository{
		currentSnapshot: currentSnapshot,
		createRecord:    record,
		packages: map[string]db.BackupPackageRecord{
			record.Metadata.PackageID: record,
		},
	}
	client, server := newBackupTestClient(t, backupapp.NewService(repo, authz.NewAuthorizer(newBackupTestAuthStore([]string{"org.settings.write"}))))
	defer server.Close()

	created, err := client.CreateBackupPackage(ctx, connectBackupRequest(&backupv1.CreateBackupPackageRequest{
		OrgId: db.DefaultDevOrganizationID,
	}))
	if err != nil {
		t.Fatalf("CreateBackupPackage returned error: %v", err)
	}
	if got := created.Msg.GetBackupPackage().GetPackageId(); got != record.Metadata.PackageID {
		t.Fatalf("expected created package id %q, got %q", record.Metadata.PackageID, got)
	}

	listed, err := client.ListBackupPackages(ctx, connectBackupRequest(&backupv1.ListBackupPackagesRequest{
		OrgId: db.DefaultDevOrganizationID,
	}))
	if err != nil {
		t.Fatalf("ListBackupPackages returned error: %v", err)
	}
	if len(listed.Msg.GetBackupPackages()) != 1 {
		t.Fatalf("expected 1 backup package, got %d", len(listed.Msg.GetBackupPackages()))
	}

	fetched, err := client.GetBackupPackage(ctx, connectBackupRequest(&backupv1.GetBackupPackageRequest{
		OrgId:     db.DefaultDevOrganizationID,
		PackageId: record.Metadata.PackageID,
	}))
	if err != nil {
		t.Fatalf("GetBackupPackage returned error: %v", err)
	}
	if !strings.Contains(fetched.Msg.GetPackageJson(), `"packageId":"package-1"`) {
		t.Fatalf("expected package json to contain package id, got %s", fetched.Msg.GetPackageJson())
	}

	preflight, err := client.PreflightRestoreBackupPackage(ctx, connectBackupRequest(&backupv1.PreflightRestoreBackupPackageRequest{
		OrgId:     db.DefaultDevOrganizationID,
		PackageId: record.Metadata.PackageID,
	}))
	if err != nil {
		t.Fatalf("PreflightRestoreBackupPackage returned error: %v", err)
	}
	if !preflight.Msg.GetDestructive() {
		t.Fatalf("expected destructive restore")
	}
	if preflight.Msg.GetPackageSummary().GetCounts()["workflow_runs"] != 1 {
		t.Fatalf("expected workflow run count 1, got %d", preflight.Msg.GetPackageSummary().GetCounts()["workflow_runs"])
	}

	applied, err := client.ApplyBackupPackage(ctx, connectBackupRequest(&backupv1.ApplyBackupPackageRequest{
		OrgId:                 db.DefaultDevOrganizationID,
		PackageId:             record.Metadata.PackageID,
		ConfirmReplaceRuntime: true,
	}))
	if err != nil {
		t.Fatalf("ApplyBackupPackage returned error: %v", err)
	}
	if got := applied.Msg.GetBackupPackage().GetPackageId(); got != record.Metadata.PackageID {
		t.Fatalf("expected applied package id %q, got %q", record.Metadata.PackageID, got)
	}
	if repo.lastAppliedPackageID != record.Metadata.PackageID {
		t.Fatalf("expected repo to apply %q, got %q", record.Metadata.PackageID, repo.lastAppliedPackageID)
	}
}

func TestBackupRoutesRequirePermission(t *testing.T) {
	service := backupapp.NewService(&connectFakeBackupRepository{}, authz.NewAuthorizer(newBackupTestAuthStore([]string{"org.members.read"})))
	client, server := newBackupTestClient(t, service)
	defer server.Close()

	_, err := client.ListBackupPackages(context.Background(), connectBackupRequest(&backupv1.ListBackupPackagesRequest{
		OrgId: db.DefaultDevOrganizationID,
	}))
	if err == nil {
		t.Fatalf("expected permission denied error")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodePermissionDenied {
		t.Fatalf("expected permission denied code, got %v", connectrpc.CodeOf(err))
	}
}

func TestBackupRoutesReportFailedPreconditionWhenUnavailable(t *testing.T) {
	service := backupapp.NewService(&connectFakeBackupRepository{
		createErr: errors.New("db: failed precondition: backup restore requires postgres runtime"),
	}, authz.NewAuthorizer(newBackupTestAuthStore([]string{"org.settings.write"})))
	client, server := newBackupTestClient(t, service)
	defer server.Close()

	_, err := client.CreateBackupPackage(context.Background(), connectBackupRequest(&backupv1.CreateBackupPackageRequest{
		OrgId: db.DefaultDevOrganizationID,
	}))
	if err == nil {
		t.Fatalf("expected failed precondition error")
	}
	if connectrpc.CodeOf(err) != connectrpc.CodeFailedPrecondition {
		t.Fatalf("expected failed precondition code, got %v", connectrpc.CodeOf(err))
	}
}

type connectFakeBackupRepository struct {
	currentSnapshot      db.Snapshot
	packages             map[string]db.BackupPackageRecord
	createRecord         db.BackupPackageRecord
	createErr            error
	listErr              error
	getErr               error
	loadErr              error
	applyErr             error
	lastAppliedPackageID string
}

func (f *connectFakeBackupRepository) CreateBackupPackage(context.Context, string) (db.BackupPackageRecord, error) {
	if f.createErr != nil {
		return db.BackupPackageRecord{}, f.createErr
	}
	return f.createRecord, nil
}

func (f *connectFakeBackupRepository) ListBackupPackages(context.Context) ([]db.BackupPackageMetadata, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	items := make([]db.BackupPackageMetadata, 0, len(f.packages))
	for _, record := range f.packages {
		items = append(items, record.Metadata)
	}
	return items, nil
}

func (f *connectFakeBackupRepository) GetBackupPackage(_ context.Context, packageID string) (db.BackupPackageRecord, bool, error) {
	if f.getErr != nil {
		return db.BackupPackageRecord{}, false, f.getErr
	}
	record, ok := f.packages[packageID]
	return record, ok, nil
}

func (f *connectFakeBackupRepository) LoadCurrentBackupSnapshot(context.Context) (db.Snapshot, error) {
	if f.loadErr != nil {
		return db.Snapshot{}, f.loadErr
	}
	return f.currentSnapshot, nil
}

func (f *connectFakeBackupRepository) ApplyBackupPackage(_ context.Context, packageID string) (db.BackupPackageRecord, error) {
	if f.applyErr != nil {
		return db.BackupPackageRecord{}, f.applyErr
	}
	f.lastAppliedPackageID = packageID
	record, ok := f.packages[packageID]
	if !ok {
		return db.BackupPackageRecord{}, errors.New("backup package not found")
	}
	return record, nil
}

func newBackupTestClient(t *testing.T, service *backupapp.Service) (backupv1connect.BackupServiceClient, *httptest.Server) {
	t.Helper()

	mux := http.NewServeMux()
	RegisterRoutes(mux, RouteDependencies{
		BackupService: service,
	})
	server := httptest.NewServer(mux)
	return backupv1connect.NewBackupServiceClient(server.Client(), server.URL), server
}

func connectBackupRequest[T any](msg *T) *connectrpc.Request[T] {
	req := connectrpc.NewRequest(msg)
	req.Header().Set("Cookie", authsession.BuildRequestCookieHeader(db.DefaultDevOrganizationID, db.DefaultDevUserID))
	return req
}

func newBackupTestAuthStore(permissions []string) *db.MemoryStore {
	store := db.NewMemoryStore()
	store.Organizations[db.DefaultDevOrganizationID] = orgdomain.Organization{
		ID:                   db.DefaultDevOrganizationID,
		Slug:                 "dev-org",
		DisplayName:          "Development Organization",
		DefaultUILocale:      "zh-CN",
		DefaultContentLocale: "zh-CN",
	}
	store.Users[db.DefaultDevUserID] = authdomain.User{
		ID:                db.DefaultDevUserID,
		Email:             "dev-user@hualala.local",
		DisplayName:       "Development Operator",
		PreferredUILocale: "zh-CN",
		Timezone:          "Asia/Shanghai",
	}
	store.Roles[db.DefaultDevRoleID] = orgdomain.Role{
		ID:          db.DefaultDevRoleID,
		OrgID:       db.DefaultDevOrganizationID,
		Code:        "admin",
		DisplayName: "Administrator",
	}
	store.Memberships[db.DefaultDevMembershipID] = orgdomain.Member{
		ID:     db.DefaultDevMembershipID,
		OrgID:  db.DefaultDevOrganizationID,
		UserID: db.DefaultDevUserID,
		RoleID: db.DefaultDevRoleID,
		Status: "active",
	}
	store.RolePermissions[db.DefaultDevRoleID] = append([]string(nil), permissions...)
	return store
}

func mustBuildConnectBackupRecord(t *testing.T, packageID string, snapshot db.Snapshot, createdAt time.Time) db.BackupPackageRecord {
	t.Helper()

	summary, err := db.SummarizeBackupSnapshot(snapshot)
	if err != nil {
		t.Fatalf("SummarizeBackupSnapshot returned error: %v", err)
	}
	return db.BackupPackageRecord{
		Metadata: db.BackupPackageMetadata{
			PackageID:       packageID,
			SchemaVersion:   db.BackupPackageSchemaVersionV1,
			RestoreMode:     db.BackupPackageRestoreModeFullRuntime,
			CreatedAt:       createdAt,
			CreatedByUserID: db.DefaultDevUserID,
			OrgIDs:          summary.OrgIDs,
			ProjectIDs:      summary.ProjectIDs,
			Counts:          summary.Counts,
			PayloadBytes:    summary.PayloadBytes,
		},
		Snapshot: snapshot,
	}
}
