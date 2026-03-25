export type BackupSessionViewModel = {
  sessionId: string;
  orgId: string;
  userId: string;
  locale: string;
  roleId: string;
  roleCode: string;
  permissionCodes: string[];
  timezone: string;
};

export type BackupSummaryViewModel = {
  orgIds: string[];
  projectIds: string[];
  counts: Record<string, number>;
  payloadBytes: number;
};

export type BackupPackageViewModel = BackupSummaryViewModel & {
  packageId: string;
  schemaVersion: string;
  restoreMode: string;
  createdAt: string;
  createdByUserId: string;
};

export type BackupPreflightViewModel = {
  packageId: string;
  packageSummary: BackupSummaryViewModel;
  currentSummary: BackupSummaryViewModel;
  warnings: string[];
  destructive: boolean;
};

export type BackupCapabilitiesViewModel = {
  canManageBackup: boolean;
};

export type AdminBackupViewModel = {
  currentSession: BackupSessionViewModel;
  backupPackages: BackupPackageViewModel[];
  capabilities: BackupCapabilitiesViewModel;
};
