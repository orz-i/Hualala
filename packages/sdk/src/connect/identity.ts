export type DevIdentity = {
  orgId?: string;
  userId?: string;
};

export function buildIdentityHeaders(identity: DevIdentity): Record<string, string> {
  const headers: Record<string, string> = {};
  if (identity.orgId && identity.orgId.trim() !== "") {
    headers["X-Hualala-Org-Id"] = identity.orgId.trim();
  }
  if (identity.userId && identity.userId.trim() !== "") {
    headers["X-Hualala-User-Id"] = identity.userId.trim();
  }
  return headers;
}

export function withIdentityHeaders(
  headers: Record<string, string>,
  identity: DevIdentity,
): Record<string, string> {
  return {
    ...headers,
    ...buildIdentityHeaders(identity),
  };
}
