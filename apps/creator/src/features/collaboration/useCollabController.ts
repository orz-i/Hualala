import { createContentClient } from "@hualala/sdk";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { useQueuedSilentRefresh } from "../shared/useQueuedSilentRefresh";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import type {
  CollaborationOwnerType,
  CollaborationSessionViewModel,
} from "./collaboration";
import { loadCollaborationSession } from "./loadCollaborationSession";
import { subscribeCollaborationEvents } from "./subscribeCollaborationEvents";

const DEFAULT_LEASE_TTL_SECONDS = 120;

function formatActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

function parseDraftVersion(input: string, fallback: number) {
  const nextValue = Number.parseInt(input.trim(), 10);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

export function useCollabController({
  enabled,
  ownerType,
  ownerId,
  projectId,
  t,
  orgId,
  userId,
}: {
  enabled: boolean;
  ownerType: CollaborationOwnerType;
  ownerId: string;
  projectId?: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
}) {
  const [collaborationSession, setCollaborationSession] =
    useState<CollaborationSessionViewModel | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [claimDraftVersionInput, setClaimDraftVersionInput] = useState("");
  const [conflictSummaryInput, setConflictSummaryInput] = useState("");

  const client = useMemo(
    () =>
      createContentClient({
        identity: {
          orgId,
          userId,
        },
      }),
    [orgId, userId],
  );

  const refreshCollaboration = useCallback(async () => {
    const nextSession = await loadCollaborationSession({
      ownerType,
      ownerId,
      projectId,
      orgId,
      userId,
    });
    startTransition(() => {
      setCollaborationSession(nextSession);
      setClaimDraftVersionInput(String(nextSession.session.draftVersion));
      setErrorMessage("");
    });
    return nextSession;
  }, [orgId, ownerId, ownerType, projectId, userId]);

  const scheduleSilentRefresh = useQueuedSilentRefresh("collaboration", refreshCollaboration);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setCollaborationSession(null);
        setFeedback(null);
        setErrorMessage("");
        setClaimDraftVersionInput("");
        setConflictSummaryInput("");
      });
      return;
    }

    let cancelled = false;
    loadCollaborationSession({
      ownerType,
      ownerId,
      projectId,
      orgId,
      userId,
    })
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setCollaborationSession(nextSession);
          setClaimDraftVersionInput(String(nextSession.session.draftVersion));
          setConflictSummaryInput(nextSession.session.conflictSummary);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setCollaborationSession(null);
          setErrorMessage(
            error instanceof Error ? error.message : "creator: unknown collaboration error",
          );
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, ownerId, ownerType, projectId, userId]);

  useEffect(() => {
    if (
      !enabled ||
      !collaborationSession?.scope.organizationId ||
      !collaborationSession.scope.projectId
    ) {
      return;
    }

    return subscribeCollaborationEvents({
      organizationId: collaborationSession.scope.organizationId,
      projectId: collaborationSession.scope.projectId,
      ownerType,
      ownerId,
      orgId,
      userId,
      onRefreshNeeded: scheduleSilentRefresh,
      onError: (error) => {
        console.warn("creator: collaboration sse subscription failed", error);
      },
    });
  }, [
    collaborationSession?.scope.organizationId,
    collaborationSession?.scope.projectId,
    collaborationSession?.session.sessionId,
    enabled,
    orgId,
    ownerId,
    ownerType,
    scheduleSilentRefresh,
    userId,
  ]);

  const handleClaimLease = useCallback(async () => {
    if (!userId || !ownerId) {
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.claimCollab", {
            message: "creator: missing collaboration actor",
          }),
        });
      });
      return;
    }

    startTransition(() => {
      setFeedback({
        tone: "pending",
        message: t("feedback.pending.claimCollab"),
      });
    });

    try {
      await waitForFeedbackPaint();
      await client.upsertCollaborationLease({
        ownerType,
        ownerId,
        actorUserId: userId,
        presenceStatus: "editing",
        draftVersion: parseDraftVersion(
          claimDraftVersionInput,
          collaborationSession?.session.draftVersion ?? 0,
        ),
        leaseTtlSeconds: DEFAULT_LEASE_TTL_SECONDS,
      });
      const nextSession = await refreshCollaboration();
      startTransition(() => {
        setFeedback({
          tone: "success",
          message: t("feedback.success.claimCollab"),
        });
        setConflictSummaryInput(nextSession.session.conflictSummary);
      });
    } catch (error: unknown) {
      const message = formatActionErrorMessage(
        error,
        "creator: unknown collaboration claim error",
      );
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.claimCollab", { message }),
        });
      });
    }
  }, [
    claimDraftVersionInput,
    client,
    collaborationSession?.session.draftVersion,
    ownerId,
    ownerType,
    refreshCollaboration,
    t,
    userId,
  ]);

  const handleReleaseLease = useCallback(async () => {
    if (!userId || !ownerId) {
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.releaseCollab", {
            message: "creator: missing collaboration actor",
          }),
        });
      });
      return;
    }

    startTransition(() => {
      setFeedback({
        tone: "pending",
        message: t("feedback.pending.releaseCollab"),
      });
    });

    try {
      await waitForFeedbackPaint();
      await client.releaseCollaborationLease({
        ownerType,
        ownerId,
        actorUserId: userId,
        conflictSummary: conflictSummaryInput.trim(),
      });
      const nextSession = await refreshCollaboration();
      startTransition(() => {
        setFeedback({
          tone: "success",
          message: t("feedback.success.releaseCollab"),
        });
        setConflictSummaryInput(nextSession.session.conflictSummary);
      });
    } catch (error: unknown) {
      const message = formatActionErrorMessage(
        error,
        "creator: unknown collaboration release error",
      );
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.releaseCollab", { message }),
        });
      });
    }
  }, [
    client,
    conflictSummaryInput,
    ownerId,
    ownerType,
    refreshCollaboration,
    t,
    userId,
  ]);

  return {
    collaborationSession,
    feedback,
    errorMessage,
    claimDraftVersionInput,
    conflictSummaryInput,
    setClaimDraftVersionInput,
    setConflictSummaryInput,
    handleClaimLease,
    handleReleaseLease,
  };
}
