import { createContentClient, type HualalaFetch } from "@hualala/sdk";
import { loadShotWorkbench } from "../shot-workbench/loadShotWorkbench";
import type {
  CollaborationOwnerType,
  CollaborationSessionViewModel,
} from "./collaboration";
import { normalizeTimestamp } from "./collaboration";

type LoadCollaborationSessionOptions = {
  ownerType: CollaborationOwnerType;
  ownerId: string;
  projectId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetCollaborationSessionResponse = {
  session?: {
    sessionId?: string;
    ownerType?: string;
    ownerId?: string;
    draftVersion?: number;
    lockHolderUserId?: string;
    leaseExpiresAt?: unknown;
    conflictSummary?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
    presences?: Array<{
      presenceId?: string;
      sessionId?: string;
      userId?: string;
      status?: string;
      lastSeenAt?: unknown;
      leaseExpiresAt?: unknown;
    }>;
  };
};

async function resolveCollaborationScope({
  ownerType,
  ownerId,
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: LoadCollaborationSessionOptions) {
  if (ownerType === "project") {
    return {
      organizationId: orgId,
      projectId: ownerId,
    };
  }

  if (projectId && orgId) {
    return {
      organizationId: orgId,
      projectId,
    };
  }

  try {
    const shotWorkbench = await loadShotWorkbench({
      shotId: ownerId,
      orgId,
      userId,
      baseUrl,
      fetchFn,
    });
    return {
      organizationId: shotWorkbench.shotExecution.orgId || orgId,
      projectId: shotWorkbench.shotExecution.projectId || projectId,
    };
  } catch {
    return {
      organizationId: orgId,
      projectId,
    };
  }
}

export async function loadCollaborationSession(
  options: LoadCollaborationSessionOptions,
): Promise<CollaborationSessionViewModel> {
  const client = createContentClient({
    baseUrl: options.baseUrl,
    fetchFn: options.fetchFn,
    identity: {
      orgId: options.orgId,
      userId: options.userId,
    },
  });
  const payload = (await client.getCollaborationSession({
    ownerType: options.ownerType,
    ownerId: options.ownerId,
  })) as GetCollaborationSessionResponse;

  const session = payload.session;
  if (!session?.sessionId || !session.ownerId) {
    throw new Error("creator: collaboration session payload is incomplete");
  }

  return {
    session: {
      sessionId: session.sessionId,
      ownerType: session.ownerType ?? options.ownerType,
      ownerId: session.ownerId,
      draftVersion: session.draftVersion ?? 0,
      lockHolderUserId: session.lockHolderUserId ?? "",
      leaseExpiresAt: normalizeTimestamp(session.leaseExpiresAt),
      conflictSummary: session.conflictSummary ?? "",
      createdAt: normalizeTimestamp(session.createdAt),
      updatedAt: normalizeTimestamp(session.updatedAt),
    },
    presences: (session.presences ?? []).map((presence) => ({
      presenceId: presence.presenceId ?? "",
      sessionId: presence.sessionId ?? session.sessionId ?? "",
      userId: presence.userId ?? "",
      status: presence.status ?? "idle",
      lastSeenAt: normalizeTimestamp(presence.lastSeenAt),
      leaseExpiresAt: normalizeTimestamp(presence.leaseExpiresAt),
    })),
    scope: await resolveCollaborationScope(options),
    alerts: [],
  };
}
