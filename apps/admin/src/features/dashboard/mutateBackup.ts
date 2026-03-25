import {
  createBackupClient,
  type BackupPackage as BackupPackagePayload,
  type BackupSummary as BackupSummaryPayload,
  type HualalaFetch,
} from "@hualala/sdk";
import type {
  BackupPackageViewModel,
  BackupPreflightViewModel,
  BackupSummaryViewModel,
} from "./backup";

type BackupMutationOptions = {
  orgId: string;
  userId: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function createBackupPackage({
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: BackupMutationOptions) {
  const client = createBackupClient({
    baseUrl,
    fetchFn,
    identity: { orgId, userId },
  });
  const payload = await client.createBackupPackage({ orgId });
  return mapBackupPackage(payload.backupPackage);
}

export async function getBackupPackage({
  orgId,
  userId,
  packageId,
  baseUrl,
  fetchFn,
}: BackupMutationOptions & {
  packageId: string;
}) {
  const client = createBackupClient({
    baseUrl,
    fetchFn,
    identity: { orgId, userId },
  });
  const payload = await client.getBackupPackage({ orgId, packageId });
  return {
    backupPackage: mapBackupPackage(payload.backupPackage),
    packageJson: payload.packageJson ?? "",
  };
}

export async function preflightRestoreBackupPackage({
  orgId,
  userId,
  packageId,
  baseUrl,
  fetchFn,
}: BackupMutationOptions & {
  packageId: string;
}): Promise<BackupPreflightViewModel> {
  const client = createBackupClient({
    baseUrl,
    fetchFn,
    identity: { orgId, userId },
  });
  const payload = await client.preflightRestoreBackupPackage({ orgId, packageId });
  return {
    packageId,
    packageSummary: mapBackupSummary(payload.packageSummary),
    currentSummary: mapBackupSummary(payload.currentSummary),
    warnings: [...(payload.warnings ?? [])],
    destructive: Boolean(payload.destructive),
  };
}

export async function applyBackupPackage({
  orgId,
  userId,
  packageId,
  baseUrl,
  fetchFn,
}: BackupMutationOptions & {
  packageId: string;
}) {
  const client = createBackupClient({
    baseUrl,
    fetchFn,
    identity: { orgId, userId },
  });
  const payload = await client.applyBackupPackage({
    orgId,
    packageId,
    confirmReplaceRuntime: true,
  });
  return mapBackupPackage(payload.backupPackage);
}

function mapBackupPackage(record?: BackupPackagePayload | null): BackupPackageViewModel {
  return {
    packageId: record?.packageId ?? "",
    schemaVersion: record?.schemaVersion ?? "",
    restoreMode: record?.restoreMode ?? "",
    createdAt: normalizeTimestamp(record?.createdAt),
    createdByUserId: record?.createdByUserId ?? "",
    ...mapBackupSummary(record?.summary),
  };
}

function mapBackupSummary(summary?: BackupSummaryPayload | null): BackupSummaryViewModel {
  const counts = Object.fromEntries(
    Object.entries(summary?.counts ?? {}).map(([key, value]) => [key, Number(value ?? 0)]),
  );
  return {
    orgIds: [...(summary?.orgIds ?? [])],
    projectIds: [...(summary?.projectIds ?? [])],
    counts,
    payloadBytes: Number(summary?.payloadBytes ?? 0),
  };
}

function normalizeTimestamp(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    if ("seconds" in value) {
      const seconds = Number((value as { seconds?: number | bigint }).seconds ?? 0);
      const nanos = Number((value as { nanos?: number }).nanos ?? 0);
      return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
    }
  }
  return "";
}
