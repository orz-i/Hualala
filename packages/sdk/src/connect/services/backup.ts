import type {
  ApplyBackupPackageResponse,
  CreateBackupPackageResponse,
  GetBackupPackageResponse,
  ListBackupPackagesResponse,
  PreflightRestoreBackupPackageResponse,
} from "../../gen/hualala/backup/v1/backup_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export function createBackupClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    createBackupPackage(body: { orgId: string }) {
      return client.unary<CreateBackupPackageResponse>(
        "/hualala.backup.v1.BackupService/CreateBackupPackage",
        body,
        "sdk: failed to create backup package",
      );
    },
    listBackupPackages(body: { orgId: string }) {
      return client.unary<ListBackupPackagesResponse>(
        "/hualala.backup.v1.BackupService/ListBackupPackages",
        body,
        "sdk: failed to list backup packages",
      );
    },
    getBackupPackage(body: { orgId: string; packageId: string }) {
      return client.unary<GetBackupPackageResponse>(
        "/hualala.backup.v1.BackupService/GetBackupPackage",
        body,
        "sdk: failed to get backup package",
      );
    },
    preflightRestoreBackupPackage(body: { orgId: string; packageId: string }) {
      return client.unary<PreflightRestoreBackupPackageResponse>(
        "/hualala.backup.v1.BackupService/PreflightRestoreBackupPackage",
        body,
        "sdk: failed to preflight backup restore",
      );
    },
    applyBackupPackage(body: {
      orgId: string;
      packageId: string;
      confirmReplaceRuntime: boolean;
    }) {
      return client.unary<ApplyBackupPackageResponse>(
        "/hualala.backup.v1.BackupService/ApplyBackupPackage",
        body,
        "sdk: failed to apply backup package",
      );
    },
  };
}
