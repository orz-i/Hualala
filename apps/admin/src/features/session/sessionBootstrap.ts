import { createAuthOrgClient, type HualalaFetch } from "@hualala/sdk";

export type SessionViewModel = {
  sessionId: string;
  orgId: string;
  userId: string;
  locale: string;
};

type SessionBootstrapOptions = {
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

function mapSession(payload: {
  session?: {
    sessionId?: string;
    orgId?: string;
    userId?: string;
    locale?: string;
  };
}): SessionViewModel {
  const session = payload.session;
  if (!session?.sessionId || !session.orgId || !session.userId) {
    throw new Error("admin: auth session payload is incomplete");
  }
  return {
    sessionId: session.sessionId,
    orgId: session.orgId,
    userId: session.userId,
    locale: session.locale ?? "zh-CN",
  };
}

export async function loadCurrentSession({
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
  return mapSession(await client.getCurrentSession());
}

export async function ensureDevSession({
  baseUrl,
  fetchFn,
}: Omit<SessionBootstrapOptions, "orgId" | "userId"> = {}): Promise<SessionViewModel> {
  const client = createAuthOrgClient({
    baseUrl,
    fetchFn,
  });
  return mapSession(await client.startDevSession());
}

export async function clearCurrentSession({
  baseUrl,
  fetchFn,
}: Omit<SessionBootstrapOptions, "orgId" | "userId"> = {}): Promise<void> {
  const client = createAuthOrgClient({
    baseUrl,
    fetchFn,
  });
  await client.clearCurrentSession();
}

export function isUnauthenticatedSessionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unauthenticated") || message.includes("(401)") || message.includes(" 401");
}
