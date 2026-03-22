import { startTransition, useCallback, useEffect, useState } from "react";
import {
  ensureDevSession,
  isUnauthenticatedSessionError,
  loadCurrentSession,
  clearCurrentSession,
  type SessionViewModel,
} from "./sessionBootstrap";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

export function useAdminSessionGate({
  identityOverride,
}: {
  identityOverride: IdentityOverride;
}) {
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unauthenticated">(
    "loading",
  );
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setSessionState("loading");
      setSession(null);
      setErrorMessage("");
    });

    loadCurrentSession({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setSession(nextSession);
          setSessionState("ready");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isUnauthenticatedSessionError(error)) {
          startTransition(() => {
            setSession(null);
            setSessionState("unauthenticated");
          });
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown session bootstrap error";
        startTransition(() => {
          setErrorMessage(message);
          setSession(null);
          setSessionState("unauthenticated");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [identityOverride?.orgId, identityOverride?.userId]);

  const handleStartDevSession = useCallback(async () => {
    startTransition(() => {
      setSessionState("loading");
      setErrorMessage("");
    });

    try {
      const nextSession = await ensureDevSession();
      startTransition(() => {
        setSession(nextSession);
        setSessionState("ready");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown start session error";
      startTransition(() => {
        setErrorMessage(message);
        setSessionState("unauthenticated");
      });
    }
  }, []);

  const handleClearCurrentSession = useCallback(async () => {
    try {
      await clearCurrentSession();
      startTransition(() => {
        setSession(null);
        setSessionState("unauthenticated");
        setErrorMessage("");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown clear session error";
      startTransition(() => {
        setErrorMessage(message);
      });
    }
  }, []);

  return {
    sessionState,
    session,
    errorMessage,
    effectiveOrgId: identityOverride?.orgId ?? session?.orgId ?? "",
    effectiveUserId: identityOverride?.userId ?? session?.userId ?? "",
    subscriptionOrgId: identityOverride?.orgId ?? session?.orgId,
    handleStartDevSession,
    handleClearCurrentSession,
  };
}
