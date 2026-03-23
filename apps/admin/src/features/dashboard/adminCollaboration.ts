export type AdminCollaborationSessionViewModel = {
  session: {
    sessionId: string;
    ownerType: string;
    ownerId: string;
    draftVersion: number;
    lockHolderUserId: string;
    leaseExpiresAt: string;
    conflictSummary: string;
    createdAt: string;
    updatedAt: string;
  };
  presences: Array<{
    presenceId: string;
    sessionId: string;
    userId: string;
    status: string;
    lastSeenAt: string;
    leaseExpiresAt: string;
  }>;
  scope: {
    organizationId?: string;
    projectId?: string;
  };
  alerts: string[];
};

function toSeconds(value: unknown) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeAdminTimestamp(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  const seconds = toSeconds((value as { seconds?: unknown }).seconds);
  const nanos = toSeconds((value as { nanos?: unknown }).nanos);
  if (seconds <= 0 && nanos <= 0) {
    return "";
  }

  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

export function isAdminLeaseStale(leaseExpiresAt: string) {
  if (!leaseExpiresAt) {
    return false;
  }
  const expiresAt = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt <= Date.now();
}
