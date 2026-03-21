import { createAuthOrgClient } from "../connect/services/authOrg";
import type { HualalaFetch } from "../connect/transport";

export type SessionViewModel = {
  sessionId: string;
  orgId: string;
  userId: string;
  locale: string;
};

export type SessionBootstrapOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

function buildIdentity(orgId?: string, userId?: string) {
  if (!orgId || !userId) {
    return undefined;
  }
  return {
    orgId,
    userId,
  };
}

function mapSession(
  scope: string,
  payload: {
    session?: {
      sessionId?: string;
      orgId?: string;
      userId?: string;
      locale?: string;
    };
  },
): SessionViewModel {
  const session = payload.session;
  if (!session?.sessionId || !session.orgId || !session.userId) {
    throw new Error(`${scope}: auth session payload is incomplete`);
  }
  return {
    sessionId: session.sessionId,
    orgId: session.orgId,
    userId: session.userId,
    locale: session.locale ?? "zh-CN",
  };
}

export function createSessionBootstrap(scope: string) {
  return {
    async loadCurrentSession({
      orgId,
      userId,
      baseUrl,
      fetchFn,
    }: SessionBootstrapOptions): Promise<SessionViewModel> {
      const client = createAuthOrgClient({
        baseUrl,
        fetchFn,
        identity: buildIdentity(orgId, userId),
      });
      return mapSession(scope, await client.getCurrentSession());
    },
    async ensureDevSession({
      baseUrl,
      fetchFn,
    }: Omit<SessionBootstrapOptions, "orgId" | "userId"> = {}): Promise<SessionViewModel> {
      const client = createAuthOrgClient({
        baseUrl,
        fetchFn,
      });
      return mapSession(scope, await client.startDevSession());
    },
    async clearCurrentSession({
      baseUrl,
      fetchFn,
    }: Omit<SessionBootstrapOptions, "orgId" | "userId"> = {}): Promise<void> {
      const client = createAuthOrgClient({
        baseUrl,
        fetchFn,
      });
      await client.clearCurrentSession();
    },
  };
}

export function isUnauthenticatedSessionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unauthenticated") || message.includes("(401)") || message.includes(" 401");
}
