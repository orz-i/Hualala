import { createContentClient } from "@hualala/sdk";
import type { AdminCollaborationSessionViewModel } from "./adminCollaboration";
import { normalizeAdminTimestamp } from "./adminCollaboration";

type LoadAdminCollaborationSessionOptions = {
  ownerType: "project" | "shot";
  ownerId: string;
  projectId: string;
  orgId: string;
  userId: string;
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

export async function loadAdminCollaborationSession({
  ownerType,
  ownerId,
  projectId,
  orgId,
  userId,
}: LoadAdminCollaborationSessionOptions): Promise<AdminCollaborationSessionViewModel> {
  const client = createContentClient({
    identity: {
      orgId,
      userId,
    },
  });
  const payload = (await client.getCollaborationSession({
    ownerType,
    ownerId,
  })) as GetCollaborationSessionResponse;
  const session = payload.session;

  if (!session?.sessionId || !session.ownerId) {
    throw new Error("admin: collaboration session payload is incomplete");
  }

  return {
    session: {
      sessionId: session.sessionId,
      ownerType: session.ownerType ?? ownerType,
      ownerId: session.ownerId,
      draftVersion: session.draftVersion ?? 0,
      lockHolderUserId: session.lockHolderUserId ?? "",
      leaseExpiresAt: normalizeAdminTimestamp(session.leaseExpiresAt),
      conflictSummary: session.conflictSummary ?? "",
      createdAt: normalizeAdminTimestamp(session.createdAt),
      updatedAt: normalizeAdminTimestamp(session.updatedAt),
    },
    presences: (session.presences ?? []).map((presence) => ({
      presenceId: presence.presenceId ?? "",
      sessionId: presence.sessionId ?? session.sessionId ?? "",
      userId: presence.userId ?? "",
      status: presence.status ?? "idle",
      lastSeenAt: normalizeAdminTimestamp(presence.lastSeenAt),
      leaseExpiresAt: normalizeAdminTimestamp(presence.leaseExpiresAt),
    })),
    scope: {
      organizationId: orgId,
      projectId,
    },
    alerts: [],
  };
}
