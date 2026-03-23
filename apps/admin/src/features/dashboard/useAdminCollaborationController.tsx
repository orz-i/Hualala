import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AdminCollaborationSessionViewModel } from "./adminCollaboration";
import { loadAdminCollaborationSession } from "./loadAdminCollaborationSession";
import { subscribeAdminCollaboration } from "./subscribeAdminCollaboration";

export function useAdminCollaborationController({
  sessionState,
  enabled,
  projectId,
  shotId,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  enabled: boolean;
  projectId: string;
  shotId?: string;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  void t;
  const [collaborationSession, setCollaborationSession] =
    useState<AdminCollaborationSessionViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const refreshStateRef = useRef({
    inFlight: false,
    queued: false,
  });

  const ownerType = shotId ? "shot" : "project";
  const ownerId = shotId ?? projectId;

  const loadState = useCallback(async () => {
    const nextSession = await loadAdminCollaborationSession({
      ownerType,
      ownerId,
      projectId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
    });
    startTransition(() => {
      setCollaborationSession(nextSession);
      setErrorMessage("");
    });
    return nextSession;
  }, [effectiveOrgId, effectiveUserId, ownerId, ownerType, projectId]);

  const refreshCollaborationSilently = useCallback(async () => {
    const state = refreshStateRef.current;
    if (state.inFlight) {
      state.queued = true;
      return;
    }

    state.inFlight = true;
    const runRefresh = async () => {
      try {
        await loadState();
      } catch (error: unknown) {
        console.warn("admin: collaboration refresh failed", error);
      } finally {
        if (state.queued) {
          state.queued = false;
          void runRefresh();
          return;
        }
        state.inFlight = false;
      }
    };

    await runRefresh();
  }, [loadState]);

  useEffect(() => {
    if (sessionState !== "ready" || !enabled) {
      startTransition(() => {
        setCollaborationSession(null);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;
    loadAdminCollaborationSession({
      ownerType,
      ownerId,
      projectId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
    })
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setCollaborationSession(nextSession);
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
            error instanceof Error ? error.message : "admin: unknown collaboration error",
          );
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    effectiveOrgId,
    effectiveUserId,
    enabled,
    ownerId,
    ownerType,
    projectId,
    sessionState,
  ]);

  useEffect(() => {
    if (
      sessionState !== "ready" ||
      !enabled ||
      !effectiveOrgId ||
      !projectId
    ) {
      return;
    }

    return subscribeAdminCollaboration({
      organizationId: effectiveOrgId,
      projectId,
      ownerType,
      ownerId,
      onRefreshNeeded: () => {
        void refreshCollaborationSilently();
      },
      onError: (error) => {
        console.warn("admin: collaboration sse subscription failed", error);
      },
    });
  }, [
    effectiveOrgId,
    enabled,
    ownerId,
    ownerType,
    projectId,
    refreshCollaborationSilently,
    sessionState,
  ]);

  return {
    collaborationSession,
    errorMessage,
    refreshCollaborationSilently,
  };
}
