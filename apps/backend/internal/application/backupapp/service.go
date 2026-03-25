package backupapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/hualala/apps/backend/internal/platform/authz"
	"github.com/hualala/apps/backend/internal/platform/db"
)

const backupPermissionOrgSettingsWrite = "org.settings.write"

const backupSingleOrgRuntimeScopeError = "backupapp: failed precondition: whole-runtime backup requires single-org runtime scope matching target org"

type Service struct {
	repo       db.BackupRepository
	authorizer authz.Authorizer
}

type CreateBackupPackageInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type ListBackupPackagesInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
}

type GetBackupPackageInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
	PackageID    string
}

type PreflightRestoreBackupPackageInput struct {
	ActorOrgID   string
	ActorUserID  string
	CookieHeader string
	OrgID        string
	PackageID    string
}

type ApplyBackupPackageInput struct {
	ActorOrgID            string
	ActorUserID           string
	CookieHeader          string
	OrgID                 string
	PackageID             string
	ConfirmReplaceRuntime bool
}

type GetBackupPackageOutput struct {
	Package     db.BackupPackageMetadata
	PackageJSON string
}

type PreflightRestoreBackupPackageOutput struct {
	PackageSummary db.BackupSummary
	CurrentSummary db.BackupSummary
	Warnings       []string
	Destructive    bool
}

func NewService(repo db.BackupRepository, authorizer authz.Authorizer) *Service {
	return &Service{repo: repo, authorizer: authorizer}
}

func (s *Service) CreateBackupPackage(ctx context.Context, input CreateBackupPackageInput) (db.BackupPackageMetadata, error) {
	principal, err := s.resolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	if err := s.requireSingleOrgRuntimeScope(ctx, principal.OrgID); err != nil {
		return db.BackupPackageMetadata{}, err
	}
	record, err := s.repo.CreateBackupPackage(ctx, principal.UserID)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	record, err = normalizeBackupPackageRecord(record)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	if !backupPackageMatchesSingleOrgScope(record.Metadata, principal.OrgID) {
		return db.BackupPackageMetadata{}, errors.New(backupSingleOrgRuntimeScopeError)
	}
	return record.Metadata, nil
}

func (s *Service) ListBackupPackages(ctx context.Context, input ListBackupPackagesInput) ([]db.BackupPackageMetadata, error) {
	principal, err := s.resolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID)
	if err != nil {
		return nil, err
	}
	if err := s.requireSingleOrgRuntimeScope(ctx, principal.OrgID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListBackupPackages(ctx)
	if err != nil {
		return nil, err
	}
	filtered := make([]db.BackupPackageMetadata, 0, len(items))
	for _, item := range items {
		if backupPackageMatchesSingleOrgScope(item, principal.OrgID) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *Service) GetBackupPackage(ctx context.Context, input GetBackupPackageInput) (GetBackupPackageOutput, error) {
	principal, err := s.resolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID)
	if err != nil {
		return GetBackupPackageOutput{}, err
	}
	if err := s.requireSingleOrgRuntimeScope(ctx, principal.OrgID); err != nil {
		return GetBackupPackageOutput{}, err
	}
	record, err := s.loadPackageForOrg(ctx, principal.OrgID, input.PackageID)
	if err != nil {
		return GetBackupPackageOutput{}, err
	}
	body, err := json.Marshal(record)
	if err != nil {
		return GetBackupPackageOutput{}, fmt.Errorf("backupapp: encode package json: %w", err)
	}
	return GetBackupPackageOutput{
		Package:     record.Metadata,
		PackageJSON: string(body),
	}, nil
}

func (s *Service) PreflightRestoreBackupPackage(ctx context.Context, input PreflightRestoreBackupPackageInput) (PreflightRestoreBackupPackageOutput, error) {
	principal, err := s.resolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID)
	if err != nil {
		return PreflightRestoreBackupPackageOutput{}, err
	}
	if err := s.requireSingleOrgRuntimeScope(ctx, principal.OrgID); err != nil {
		return PreflightRestoreBackupPackageOutput{}, err
	}
	record, err := s.loadPackageForOrg(ctx, principal.OrgID, input.PackageID)
	if err != nil {
		return PreflightRestoreBackupPackageOutput{}, err
	}
	currentSnapshot, err := s.repo.LoadCurrentBackupSnapshot(ctx)
	if err != nil {
		return PreflightRestoreBackupPackageOutput{}, err
	}
	currentSummary, err := db.SummarizeBackupSnapshot(currentSnapshot)
	if err != nil {
		return PreflightRestoreBackupPackageOutput{}, fmt.Errorf("backupapp: summarize current runtime: %w", err)
	}
	warnings := buildPreflightWarnings(summaryFromMetadata(record.Metadata), currentSummary)
	return PreflightRestoreBackupPackageOutput{
		PackageSummary: summaryFromMetadata(record.Metadata),
		CurrentSummary: currentSummary,
		Warnings:       warnings,
		Destructive:    true,
	}, nil
}

func (s *Service) ApplyBackupPackage(ctx context.Context, input ApplyBackupPackageInput) (db.BackupPackageMetadata, error) {
	principal, err := s.resolvePrincipal(ctx, input.ActorOrgID, input.ActorUserID, input.CookieHeader, input.OrgID)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	if !input.ConfirmReplaceRuntime {
		return db.BackupPackageMetadata{}, errors.New("backupapp: confirm_replace_runtime is required")
	}
	if err := s.requireSingleOrgRuntimeScope(ctx, principal.OrgID); err != nil {
		return db.BackupPackageMetadata{}, err
	}
	record, err := s.loadPackageForOrg(ctx, principal.OrgID, input.PackageID)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	applied, err := s.repo.ApplyBackupPackage(ctx, record.Metadata.PackageID)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	applied, err = normalizeBackupPackageRecord(applied)
	if err != nil {
		return db.BackupPackageMetadata{}, err
	}
	return applied.Metadata, nil
}

func (s *Service) loadPackageForOrg(ctx context.Context, orgID string, packageID string) (db.BackupPackageRecord, error) {
	packageKey := strings.TrimSpace(packageID)
	if packageKey == "" {
		return db.BackupPackageRecord{}, errors.New("backupapp: package_id is required")
	}
	record, ok, err := s.repo.GetBackupPackage(ctx, packageKey)
	if err != nil {
		return db.BackupPackageRecord{}, err
	}
	if !ok {
		return db.BackupPackageRecord{}, errors.New("backupapp: backup package not found")
	}
	record, err = normalizeBackupPackageRecord(record)
	if err != nil {
		return db.BackupPackageRecord{}, err
	}
	if !backupPackageMatchesSingleOrgScope(record.Metadata, orgID) {
		return db.BackupPackageRecord{}, errors.New("backupapp: backup package not found")
	}
	return record, nil
}

func (s *Service) requireSingleOrgRuntimeScope(ctx context.Context, orgID string) error {
	snapshot, err := s.repo.LoadCurrentBackupSnapshot(ctx)
	if err != nil {
		return err
	}
	summary, err := db.SummarizeBackupSnapshot(snapshot)
	if err != nil {
		return fmt.Errorf("backupapp: summarize current runtime scope: %w", err)
	}
	if !backupSummaryMatchesSingleOrgScope(summary, orgID) {
		return errors.New(backupSingleOrgRuntimeScopeError)
	}
	return nil
}

func (s *Service) resolvePrincipal(ctx context.Context, actorOrgID string, actorUserID string, cookieHeader string, orgID string) (authz.Principal, error) {
	if s == nil || s.repo == nil {
		return authz.Principal{}, errors.New("backupapp: repository is required")
	}
	targetOrgID := strings.TrimSpace(orgID)
	if targetOrgID == "" {
		return authz.Principal{}, errors.New("backupapp: org_id is required")
	}
	principal, err := s.authorizer.ResolvePrincipal(ctx, authz.ResolvePrincipalInput{
		HeaderOrgID:  actorOrgID,
		HeaderUserID: actorUserID,
		CookieHeader: cookieHeader,
	})
	if err != nil {
		return authz.Principal{}, err
	}
	if principal.OrgID != targetOrgID {
		return authz.Principal{}, errors.New("permission denied: principal does not belong to target org")
	}
	if err := s.authorizer.RequirePermission(ctx, principal, backupPermissionOrgSettingsWrite); err != nil {
		return authz.Principal{}, err
	}
	return principal, nil
}

func normalizeBackupPackageRecord(record db.BackupPackageRecord) (db.BackupPackageRecord, error) {
	if strings.TrimSpace(record.Metadata.PackageID) == "" {
		return db.BackupPackageRecord{}, errors.New("backupapp: failed precondition: backup package id is required")
	}
	if strings.TrimSpace(record.Metadata.SchemaVersion) == "" {
		record.Metadata.SchemaVersion = db.BackupPackageSchemaVersionV1
	}
	if strings.TrimSpace(record.Metadata.RestoreMode) == "" {
		record.Metadata.RestoreMode = db.BackupPackageRestoreModeFullRuntime
	}
	if record.Metadata.Counts == nil || len(record.Metadata.Counts) == 0 || len(record.Metadata.OrgIDs) == 0 && len(record.Metadata.ProjectIDs) == 0 {
		summary, err := db.SummarizeBackupSnapshot(record.Snapshot)
		if err != nil {
			return db.BackupPackageRecord{}, fmt.Errorf("backupapp: summarize backup package: %w", err)
		}
		record.Metadata.OrgIDs = summary.OrgIDs
		record.Metadata.ProjectIDs = summary.ProjectIDs
		record.Metadata.Counts = summary.Counts
		if record.Metadata.PayloadBytes == 0 {
			record.Metadata.PayloadBytes = summary.PayloadBytes
		}
	}
	if strings.TrimSpace(record.Metadata.SchemaVersion) != db.BackupPackageSchemaVersionV1 {
		return db.BackupPackageRecord{}, errors.New("backupapp: failed precondition: unsupported backup package schema")
	}
	if strings.TrimSpace(record.Metadata.RestoreMode) != db.BackupPackageRestoreModeFullRuntime {
		return db.BackupPackageRecord{}, errors.New("backupapp: failed precondition: unsupported restore mode")
	}
	if totalBackupCounts(record.Metadata.Counts) == 0 {
		return db.BackupPackageRecord{}, errors.New("backupapp: failed precondition: backup package snapshot is empty")
	}
	if record.Metadata.CreatedAt.IsZero() {
		record.Metadata.CreatedAt = time.Now().UTC()
	}
	return record, nil
}

func buildPreflightWarnings(packageSummary db.BackupSummary, currentSummary db.BackupSummary) []string {
	warnings := []string{
		"Restore will replace current runtime state and clear transient gateway results.",
	}
	if !slices.Equal(packageSummary.OrgIDs, currentSummary.OrgIDs) {
		warnings = append(warnings, "Backup org scope differs from current runtime.")
	}
	if !slices.Equal(packageSummary.ProjectIDs, currentSummary.ProjectIDs) {
		warnings = append(warnings, "Backup project scope differs from current runtime.")
	}
	currentCount := totalBackupCounts(currentSummary.Counts)
	if currentCount > 0 {
		warnings = append(warnings, fmt.Sprintf("Current runtime contains %d records that will be replaced.", currentCount))
	}
	return warnings
}

func backupPackageMatchesSingleOrgScope(metadata db.BackupPackageMetadata, orgID string) bool {
	return backupSummaryMatchesSingleOrgScope(summaryFromMetadata(metadata), orgID)
}

func backupSummaryMatchesSingleOrgScope(summary db.BackupSummary, orgID string) bool {
	targetOrgID := strings.TrimSpace(orgID)
	if targetOrgID == "" {
		return false
	}
	return len(summary.OrgIDs) == 1 && strings.TrimSpace(summary.OrgIDs[0]) == targetOrgID
}

func summaryFromMetadata(metadata db.BackupPackageMetadata) db.BackupSummary {
	return db.BackupSummary{
		OrgIDs:       append([]string(nil), metadata.OrgIDs...),
		ProjectIDs:   append([]string(nil), metadata.ProjectIDs...),
		Counts:       cloneCountMap(metadata.Counts),
		PayloadBytes: metadata.PayloadBytes,
	}
}

func cloneCountMap(input map[string]int) map[string]int {
	if len(input) == 0 {
		return map[string]int{}
	}
	cloned := make(map[string]int, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func totalBackupCounts(counts map[string]int) int {
	total := 0
	for _, value := range counts {
		total += value
	}
	return total
}
