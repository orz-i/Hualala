import { act, renderHook, waitFor } from "@testing-library/react";
import {
  clearCurrentSession,
  ensureDevSession,
  loadCurrentSession,
} from "./sessionBootstrap";
import { useAdminSessionGate } from "./useAdminSessionGate";

vi.mock("./sessionBootstrap", () => ({
  loadCurrentSession: vi.fn(),
  ensureDevSession: vi.fn(),
  clearCurrentSession: vi.fn(),
  isUnauthenticatedSessionError: (error: unknown) =>
    error instanceof Error &&
    (error.message.includes("(401)") || error.message.includes("unauthenticated")),
}));

const loadCurrentSessionMock = vi.mocked(loadCurrentSession);
const ensureDevSessionMock = vi.mocked(ensureDevSession);
const clearCurrentSessionMock = vi.mocked(clearCurrentSession);

function createSession(orgId = "org-demo-001", userId = "user-demo-001") {
  return {
    sessionId: `dev:${orgId}:${userId}`,
    orgId,
    userId,
    locale: "zh-CN",
    roleId: "role-admin",
    roleCode: "admin",
    permissionCodes: ["session.read", "org.roles.read"],
    timezone: "Asia/Shanghai",
  };
}

describe("useAdminSessionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to the session gate when bootstrap returns 401 and can start a dev session", async () => {
    loadCurrentSessionMock.mockRejectedValueOnce(new Error("sdk: failed to get current session (401)"));
    ensureDevSessionMock.mockResolvedValueOnce(createSession());

    const { result } = renderHook(() => useAdminSessionGate({ identityOverride: undefined }));

    await waitFor(() => {
      expect(result.current.sessionState).toBe("unauthenticated");
    });

    await act(async () => {
      await result.current.handleStartDevSession();
    });

    await waitFor(() => {
      expect(result.current.sessionState).toBe("ready");
    });

    expect(result.current.session?.sessionId).toBe("dev:org-demo-001:user-demo-001");
    expect(result.current.effectiveOrgId).toBe("org-demo-001");
    expect(result.current.effectiveUserId).toBe("user-demo-001");
    expect(result.current.subscriptionOrgId).toBe("org-demo-001");
  });

  it("passes identity overrides through bootstrap and exposes override identities", async () => {
    loadCurrentSessionMock.mockResolvedValueOnce(createSession("org-live-001", "user-live-001"));

    const { result } = renderHook(() =>
      useAdminSessionGate({
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.sessionState).toBe("ready");
    });

    expect(loadCurrentSessionMock).toHaveBeenCalledWith({
      orgId: "org-override-001",
      userId: "user-override-001",
    });
    expect(result.current.effectiveOrgId).toBe("org-override-001");
    expect(result.current.effectiveUserId).toBe("user-override-001");
    expect(result.current.subscriptionOrgId).toBe("org-override-001");
  });

  it("clears the active session and returns to the unauthenticated gate", async () => {
    loadCurrentSessionMock.mockResolvedValueOnce(createSession());
    clearCurrentSessionMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAdminSessionGate({ identityOverride: undefined }));

    await waitFor(() => {
      expect(result.current.sessionState).toBe("ready");
    });

    await act(async () => {
      await result.current.handleClearCurrentSession();
    });

    await waitFor(() => {
      expect(result.current.sessionState).toBe("unauthenticated");
    });

    expect(result.current.session).toBeNull();
    expect(result.current.errorMessage).toBe("");
  });

  it("surfaces non-auth bootstrap failures as a top-level error", async () => {
    loadCurrentSessionMock.mockRejectedValueOnce(new Error("admin: bootstrap exploded"));

    const { result } = renderHook(() => useAdminSessionGate({ identityOverride: undefined }));

    await waitFor(() => {
      expect(result.current.sessionState).toBe("unauthenticated");
    });

    expect(result.current.errorMessage).toBe("admin: bootstrap exploded");
    expect(result.current.session).toBeNull();
  });
});
