import {
  createAuthOrgClient,
  createBackupClient,
  type BackupPackage as BackupPackagePayload,
  type BackupSummary as BackupSummaryPayload,
  type HualalaFetch,
} from "@hualala/sdk";
import type {
  AdminBackupViewModel,
  BackupPackageViewModel,
  BackupSummaryViewModel,
} from "./backup";

type LoadBackupPanelOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

const backupPermissionOrgSettingsWrite = "org.settings.write";
const backupRuntimeUnavailableNeedle = "backup restore requires postgres runtime";

export async function loadBackupPanel({
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: LoadBackupPanelOptions): Promise<AdminBackupViewModel> {
  const identity =
    orgId && userId
      ? {
          orgId,
          userId,
        }
      : undefined;
  const authClient = createAuthOrgClient({
    baseUrl,
    fetchFn,
    identity,
  });
  const backupClient = createBackupClient({
    baseUrl,
    fetchFn,
    identity,
  });

  const sessionPayload = await authClient.getCurrentSession();
  const session = sessionPayload.session;
  if (!session?.orgId || !session.userId || !session.sessionId) {
    throw new Error("admin: auth session payload is incomplete");
  }

  const permissionCodes = [...(session.permissionCodes ?? [])];
  const canManageBackup = permissionCodes.includes(backupPermissionOrgSettingsWrite);
  const { backupPackages, isRuntimeAvailable, unavailableReason } = canManageBackup
    ? await loadBackupPackages(backupClient, session.orgId)
    : {
        backupPackages: [] as BackupPackagePayload[],
        isRuntimeAvailable: true,
        unavailableReason: "",
      };

  return {
    currentSession: {
      sessionId: session.sessionId,
      orgId: session.orgId,
      userId: session.userId,
      locale: session.locale ?? "zh-CN",
      roleId: session.roleId ?? "",
      roleCode: session.roleCode ?? "",
      permissionCodes,
      timezone: session.timezone ?? "",
    },
    backupPackages: backupPackages.map(mapBackupPackage),
    capabilities: {
      canManageBackup,
      isRuntimeAvailable,
      unavailableReason,
    },
  };
}

async function loadBackupPackages(
  backupClient: ReturnType<typeof createBackupClient>,
  orgId: string,
): Promise<{
  backupPackages: BackupPackagePayload[];
  isRuntimeAvailable: boolean;
  unavailableReason: string;
}> {
  try {
    const packagesPayload = await backupClient.listBackupPackages({ orgId });
    return {
      backupPackages: [...(packagesPayload.backupPackages ?? [])],
      isRuntimeAvailable: true,
      unavailableReason: "",
    };
  } catch (error: unknown) {
    if (isBackupRuntimeUnavailableError(error)) {
      return {
        backupPackages: [],
        isRuntimeAvailable: false,
        unavailableReason: extractBackupRuntimeUnavailableReason(error),
      };
    }
    throw error;
  }
}

function isBackupRuntimeUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("failed_precondition") ||
    normalized.includes("failed precondition") ||
    normalized.includes(backupRuntimeUnavailableNeedle);
}

function extractBackupRuntimeUnavailableReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes(backupRuntimeUnavailableNeedle)) {
    return backupRuntimeUnavailableNeedle;
  }
  return message;
}

function mapBackupPackage(record: BackupPackagePayload): BackupPackageViewModel {
  return {
    packageId: record.packageId ?? "",
    schemaVersion: record.schemaVersion ?? "",
    restoreMode: record.restoreMode ?? "",
    createdAt: normalizeTimestamp(record.createdAt),
    createdByUserId: record.createdByUserId ?? "",
    ...mapBackupSummary(record.summary),
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
