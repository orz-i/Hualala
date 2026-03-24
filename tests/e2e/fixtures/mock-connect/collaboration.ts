import type { CollaborationState } from "./types.ts";

type UpsertCollaborationLeaseBody = {
  ownerType?: string;
  ownerId?: string;
  actorUserId?: string;
  presenceStatus?: string;
  draftVersion?: number;
  leaseTtlSeconds?: number;
};

type ReleaseCollaborationLeaseBody = {
  ownerType?: string;
  ownerId?: string;
  actorUserId?: string;
  conflictSummary?: string;
};

const BASE_UPDATED_AT = Date.parse("2026-03-24T10:00:00.000Z");

function nextTimestamp(offsetSeconds: number) {
  return new Date(BASE_UPDATED_AT + offsetSeconds * 1000).toISOString();
}

function computeLeaseExpiry(leaseTtlSeconds: number | undefined, offsetSeconds: number) {
  const ttlSeconds =
    typeof leaseTtlSeconds === "number" && leaseTtlSeconds > 0 ? Math.trunc(leaseTtlSeconds) : 120;
  return nextTimestamp(offsetSeconds + ttlSeconds);
}

function upsertPresence(
  presences: CollaborationState["presences"],
  actorUserId: string,
  status: string,
  leaseExpiresAt: string,
) {
  const nextPresence = {
    presenceId: `presence-${actorUserId}`,
    sessionId: presences[0]?.sessionId ?? "session-shot-collab-1",
    userId: actorUserId,
    status,
    lastSeenAt: nextTimestamp(0),
    leaseExpiresAt,
  };
  const existingIndex = presences.findIndex((presence) => presence.userId === actorUserId);
  if (existingIndex < 0) {
    return [...presences, nextPresence];
  }
  return presences.map((presence, index) => (index === existingIndex ? nextPresence : presence));
}

export function createCollaborationState(projectId: string): CollaborationState {
  const sessionId = "session-shot-collab-1";
  return {
    projectId,
    session: {
      sessionId,
      ownerType: "shot",
      ownerId: "shot-collab-1",
      draftVersion: 7,
      lockHolderUserId: "user-reviewer-7",
      leaseExpiresAt: nextTimestamp(180),
      conflictSummary: "remote reviewer is holding the lease",
      createdAt: "2026-03-24T09:55:00.000Z",
      updatedAt: nextTimestamp(0),
    },
    presences: [
      {
        presenceId: "presence-user-live-1",
        sessionId,
        userId: "user-live-1",
        status: "idle",
        lastSeenAt: nextTimestamp(0),
        leaseExpiresAt: nextTimestamp(180),
      },
      {
        presenceId: "presence-user-reviewer-7",
        sessionId,
        userId: "user-reviewer-7",
        status: "reviewing",
        lastSeenAt: nextTimestamp(0),
        leaseExpiresAt: nextTimestamp(180),
      },
    ],
  };
}

export function buildCollaborationSessionPayload(collaborationState: CollaborationState) {
  return {
    session: {
      sessionId: collaborationState.session.sessionId,
      ownerType: collaborationState.session.ownerType,
      ownerId: collaborationState.session.ownerId,
      draftVersion: collaborationState.session.draftVersion,
      lockHolderUserId: collaborationState.session.lockHolderUserId,
      leaseExpiresAt: collaborationState.session.leaseExpiresAt,
      conflictSummary: collaborationState.session.conflictSummary,
      createdAt: collaborationState.session.createdAt,
      updatedAt: collaborationState.session.updatedAt,
      presences: collaborationState.presences.map((presence) => ({
        presenceId: presence.presenceId,
        sessionId: presence.sessionId,
        userId: presence.userId,
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
        leaseExpiresAt: presence.leaseExpiresAt,
      })),
    },
  };
}

export function upsertCollaborationLeaseState(
  collaborationState: CollaborationState,
  body: UpsertCollaborationLeaseBody,
): CollaborationState {
  const actorUserId =
    body.actorUserId ?? collaborationState.session.lockHolderUserId ?? "user-live-1";
  const leaseExpiresAt = computeLeaseExpiry(body.leaseTtlSeconds, 5);

  return {
    ...collaborationState,
    session: {
      ...collaborationState.session,
      ownerType:
        body.ownerType === "project" || body.ownerType === "shot"
          ? body.ownerType
          : collaborationState.session.ownerType,
      ownerId: body.ownerId ?? collaborationState.session.ownerId,
      draftVersion:
        typeof body.draftVersion === "number"
          ? Math.trunc(body.draftVersion)
          : collaborationState.session.draftVersion,
      lockHolderUserId: actorUserId,
      leaseExpiresAt,
      updatedAt: nextTimestamp(5),
    },
    presences: upsertPresence(
      collaborationState.presences,
      actorUserId,
      body.presenceStatus ?? "editing",
      leaseExpiresAt,
    ),
  };
}

export function releaseCollaborationLeaseState(
  collaborationState: CollaborationState,
  body: ReleaseCollaborationLeaseBody,
): CollaborationState {
  const actorUserId =
    body.actorUserId ?? collaborationState.session.lockHolderUserId ?? "user-live-1";

  return {
    ...collaborationState,
    session: {
      ...collaborationState.session,
      ownerType:
        body.ownerType === "project" || body.ownerType === "shot"
          ? body.ownerType
          : collaborationState.session.ownerType,
      ownerId: body.ownerId ?? collaborationState.session.ownerId,
      lockHolderUserId: "",
      leaseExpiresAt: "",
      conflictSummary: body.conflictSummary ?? collaborationState.session.conflictSummary,
      updatedAt: nextTimestamp(10),
    },
    presences: upsertPresence(collaborationState.presences, actorUserId, "idle", ""),
  };
}
