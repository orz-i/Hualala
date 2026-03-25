package backupapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	authdomain "github.com/hualala/apps/backend/internal/domain/auth"
	gatewaydomain "github.com/hualala/apps/backend/internal/domain/gateway"
	orgdomain "github.com/hualala/apps/backend/internal/domain/org"
	projectdomain "github.com/hualala/apps/backend/internal/domain/project"
	workflowdomain "github.com/hualala/apps/backend/internal/domain/workflow"
	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

func TestBackupServiceLifecycle(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC)
	currentSnapshot := db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {
				ID:                   db.DefaultDevOrganizationID,
				Slug:                 "dev-org",
				DisplayName:          "Development Organization",
				DefaultUILocale:      "zh-CN",
				DefaultContentLocale: "zh-CN",
			},
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
			"idem-1": {
				Provider:          "seedance",
				ExternalRequestID: "external-1",
			},
		},
	}
	packageRecord := mustBuildBackupPackageRecord(t, "package-1", currentSnapshot, now)
	repo := &fakeBackupRepository{
		currentSnapshot: currentSnapshot,
		packages: map[string]db.BackupPackageRecord{
			packageRecord.Metadata.PackageID: packageRecord,
		},
		createRecord: packageRecord,
	}
	service := newTestBackupService(repo, []string{backupPermissionOrgSettingsWrite})

	created, err := service.CreateBackupPackage(context.Background(), CreateBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("CreateBackupPackage returned error: %v", err)
	}
	if created.PackageID != packageRecord.Metadata.PackageID {
		t.Fatalf("expected created package %q, got %q", packageRecord.Metadata.PackageID, created.PackageID)
	}
	if repo.lastCreatedByUserID != db.DefaultDevUserID {
		t.Fatalf("expected create to use actor user id %q, got %q", db.DefaultDevUserID, repo.lastCreatedByUserID)
	}

	listed, err := service.ListBackupPackages(context.Background(), ListBackupPackagesInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("ListBackupPackages returned error: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1 listed package, got %d", len(listed))
	}

	fetched, err := service.GetBackupPackage(context.Background(), GetBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   packageRecord.Metadata.PackageID,
	})
	if err != nil {
		t.Fatalf("GetBackupPackage returned error: %v", err)
	}
	if !strings.Contains(fetched.PackageJSON, `"packageId":"package-1"`) {
		t.Fatalf("expected package json to include package id, got %s", fetched.PackageJSON)
	}

	preflight, err := service.PreflightRestoreBackupPackage(context.Background(), PreflightRestoreBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   packageRecord.Metadata.PackageID,
	})
	if err != nil {
		t.Fatalf("PreflightRestoreBackupPackage returned error: %v", err)
	}
	if !preflight.Destructive {
		t.Fatalf("expected destructive preflight")
	}
	if len(preflight.Warnings) == 0 {
		t.Fatalf("expected preflight warnings")
	}
	if preflight.PackageSummary.Counts["workflow_runs"] != 1 {
		t.Fatalf("expected package workflow run count 1, got %d", preflight.PackageSummary.Counts["workflow_runs"])
	}

	applied, err := service.ApplyBackupPackage(context.Background(), ApplyBackupPackageInput{
		ActorOrgID:            db.DefaultDevOrganizationID,
		ActorUserID:           db.DefaultDevUserID,
		OrgID:                 db.DefaultDevOrganizationID,
		PackageID:             packageRecord.Metadata.PackageID,
		ConfirmReplaceRuntime: true,
	})
	if err != nil {
		t.Fatalf("ApplyBackupPackage returned error: %v", err)
	}
	if applied.PackageID != packageRecord.Metadata.PackageID {
		t.Fatalf("expected applied package %q, got %q", packageRecord.Metadata.PackageID, applied.PackageID)
	}
	if repo.lastAppliedPackageID != packageRecord.Metadata.PackageID {
		t.Fatalf("expected repo to apply package %q, got %q", packageRecord.Metadata.PackageID, repo.lastAppliedPackageID)
	}
}

func TestBackupServiceGetRejectsMissingPackage(t *testing.T) {
	t.Parallel()

	service := newTestBackupService(&fakeBackupRepository{
		currentSnapshot: singleOrgRuntimeSnapshot(),
		packages:        map[string]db.BackupPackageRecord{},
	}, []string{backupPermissionOrgSettingsWrite})

	_, err := service.GetBackupPackage(context.Background(), GetBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   "missing-package",
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected missing package error, got %v", err)
	}
}

func TestBackupServiceApplyRequiresConfirmation(t *testing.T) {
	t.Parallel()

	record := mustBuildBackupPackageRecord(t, "package-apply", db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID},
		},
	}, time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC))
	service := newTestBackupService(&fakeBackupRepository{
		currentSnapshot: singleOrgRuntimeSnapshot(),
		packages: map[string]db.BackupPackageRecord{
			record.Metadata.PackageID: record,
		},
	}, []string{backupPermissionOrgSettingsWrite})

	_, err := service.ApplyBackupPackage(context.Background(), ApplyBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   record.Metadata.PackageID,
	})
	if err == nil || !strings.Contains(err.Error(), "confirm_replace_runtime") {
		t.Fatalf("expected confirmation error, got %v", err)
	}
}

func TestBackupServicePreflightRejectsEmptyPackage(t *testing.T) {
	t.Parallel()

	emptyRecord := db.BackupPackageRecord{
		Metadata: db.BackupPackageMetadata{
			PackageID:     "empty-package",
			SchemaVersion: db.BackupPackageSchemaVersionV1,
			RestoreMode:   db.BackupPackageRestoreModeFullRuntime,
			CreatedAt:     time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC),
		},
		Snapshot: db.Snapshot{},
	}
	service := newTestBackupService(&fakeBackupRepository{
		currentSnapshot: singleOrgRuntimeSnapshot(),
		packages: map[string]db.BackupPackageRecord{
			emptyRecord.Metadata.PackageID: emptyRecord,
		},
	}, []string{backupPermissionOrgSettingsWrite})

	_, err := service.PreflightRestoreBackupPackage(context.Background(), PreflightRestoreBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   emptyRecord.Metadata.PackageID,
	})
	if err == nil || !strings.Contains(err.Error(), "snapshot is empty") {
		t.Fatalf("expected empty package error, got %v", err)
	}
}

func TestBackupServiceRequiresPermission(t *testing.T) {
	t.Parallel()

	service := newTestBackupService(&fakeBackupRepository{}, []string{"org.members.read"})

	_, err := service.ListBackupPackages(context.Background(), ListBackupPackagesInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err == nil || !strings.Contains(err.Error(), "permission denied") {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestBackupServiceRejectsMultiOrgRuntimeScope(t *testing.T) {
	t.Parallel()

	const secondOrgID = "org-2"
	multiOrgSnapshot := db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID},
			secondOrgID:                 {ID: secondOrgID},
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
			"project-2": {
				ID:                   "project-2",
				OrganizationID:       secondOrgID,
				OwnerUserID:          "user-2",
				Title:                "Project 2",
				Status:               "draft",
				CurrentStage:         "planning",
				PrimaryContentLocale: "zh-CN",
			},
		},
	}
	record := mustBuildBackupPackageRecord(t, "package-multi-org-runtime", multiOrgSnapshot, time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC))
	repo := &fakeBackupRepository{
		currentSnapshot: multiOrgSnapshot,
		createRecord:    record,
		packages: map[string]db.BackupPackageRecord{
			record.Metadata.PackageID: record,
		},
	}
	service := newTestBackupService(repo, []string{backupPermissionOrgSettingsWrite})

	_, err := service.CreateBackupPackage(context.Background(), CreateBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err == nil || !strings.Contains(err.Error(), "single-org runtime scope") {
		t.Fatalf("expected single-org runtime scope error on create, got %v", err)
	}
	if repo.lastCreatedByUserID != "" {
		t.Fatalf("expected create repository to remain untouched, got %q", repo.lastCreatedByUserID)
	}

	_, err = service.ListBackupPackages(context.Background(), ListBackupPackagesInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err == nil || !strings.Contains(err.Error(), "single-org runtime scope") {
		t.Fatalf("expected single-org runtime scope error on list, got %v", err)
	}
}

func TestBackupServiceHidesMultiOrgBackupPackage(t *testing.T) {
	t.Parallel()

	const secondOrgID = "org-2"
	currentSnapshot := db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID},
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
	}
	multiOrgPackageSnapshot := db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID},
			secondOrgID:                 {ID: secondOrgID},
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
			"project-2": {
				ID:                   "project-2",
				OrganizationID:       secondOrgID,
				OwnerUserID:          "user-2",
				Title:                "Project 2",
				Status:               "draft",
				CurrentStage:         "planning",
				PrimaryContentLocale: "zh-CN",
			},
		},
	}
	record := mustBuildBackupPackageRecord(t, "package-hidden-multi-org", multiOrgPackageSnapshot, time.Date(2026, 3, 25, 10, 0, 0, 0, time.UTC))
	repo := &fakeBackupRepository{
		currentSnapshot: currentSnapshot,
		packages: map[string]db.BackupPackageRecord{
			record.Metadata.PackageID: record,
		},
	}
	service := newTestBackupService(repo, []string{backupPermissionOrgSettingsWrite})

	listed, err := service.ListBackupPackages(context.Background(), ListBackupPackagesInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err != nil {
		t.Fatalf("ListBackupPackages returned error: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("expected multi-org package to be hidden, got %d items", len(listed))
	}

	_, err = service.GetBackupPackage(context.Background(), GetBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   record.Metadata.PackageID,
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected multi-org package get to be rejected as not found, got %v", err)
	}

	_, err = service.PreflightRestoreBackupPackage(context.Background(), PreflightRestoreBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
		PackageID:   record.Metadata.PackageID,
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected multi-org package preflight to be rejected as not found, got %v", err)
	}

	_, err = service.ApplyBackupPackage(context.Background(), ApplyBackupPackageInput{
		ActorOrgID:            db.DefaultDevOrganizationID,
		ActorUserID:           db.DefaultDevUserID,
		OrgID:                 db.DefaultDevOrganizationID,
		PackageID:             record.Metadata.PackageID,
		ConfirmReplaceRuntime: true,
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected multi-org package apply to be rejected as not found, got %v", err)
	}
}

func TestBackupServicePropagatesUnavailableRepository(t *testing.T) {
	t.Parallel()

	service := newTestBackupService(&fakeBackupRepository{
		createErr: errors.New("db: failed precondition: backup restore requires postgres runtime"),
	}, []string{backupPermissionOrgSettingsWrite})

	_, err := service.CreateBackupPackage(context.Background(), CreateBackupPackageInput{
		ActorOrgID:  db.DefaultDevOrganizationID,
		ActorUserID: db.DefaultDevUserID,
		OrgID:       db.DefaultDevOrganizationID,
	})
	if err == nil || !strings.Contains(err.Error(), "failed precondition") {
		t.Fatalf("expected failed precondition, got %v", err)
	}
}

type fakeBackupRepository struct {
	currentSnapshot      db.Snapshot
	packages             map[string]db.BackupPackageRecord
	createRecord         db.BackupPackageRecord
	createErr            error
	listErr              error
	getErr               error
	loadErr              error
	applyErr             error
	lastCreatedByUserID  string
	lastAppliedPackageID string
}

func (f *fakeBackupRepository) CreateBackupPackage(_ context.Context, createdByUserID string) (db.BackupPackageRecord, error) {
	if f.createErr != nil {
		return db.BackupPackageRecord{}, f.createErr
	}
	f.lastCreatedByUserID = createdByUserID
	if f.packages == nil {
		f.packages = map[string]db.BackupPackageRecord{}
	}
	f.packages[f.createRecord.Metadata.PackageID] = f.createRecord
	return f.createRecord, nil
}

func (f *fakeBackupRepository) ListBackupPackages(context.Context) ([]db.BackupPackageMetadata, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	items := make([]db.BackupPackageMetadata, 0, len(f.packages))
	for _, record := range f.packages {
		items = append(items, record.Metadata)
	}
	return items, nil
}

func (f *fakeBackupRepository) GetBackupPackage(_ context.Context, packageID string) (db.BackupPackageRecord, bool, error) {
	if f.getErr != nil {
		return db.BackupPackageRecord{}, false, f.getErr
	}
	record, ok := f.packages[packageID]
	return record, ok, nil
}

func (f *fakeBackupRepository) LoadCurrentBackupSnapshot(context.Context) (db.Snapshot, error) {
	if f.loadErr != nil {
		return db.Snapshot{}, f.loadErr
	}
	return f.currentSnapshot, nil
}

func (f *fakeBackupRepository) ApplyBackupPackage(_ context.Context, packageID string) (db.BackupPackageRecord, error) {
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

func newTestBackupService(repo db.BackupRepository, permissions []string) *Service {
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
	return NewService(repo, authz.NewAuthorizer(store))
}

func mustBuildBackupPackageRecord(t *testing.T, packageID string, snapshot db.Snapshot, createdAt time.Time) db.BackupPackageRecord {
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

func singleOrgRuntimeSnapshot() db.Snapshot {
	return db.Snapshot{
		Organizations: map[string]orgdomain.Organization{
			db.DefaultDevOrganizationID: {ID: db.DefaultDevOrganizationID},
		},
	}
}
