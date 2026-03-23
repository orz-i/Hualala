import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadAdminCollaborationSession } from "./loadAdminCollaborationSession";
import { subscribeAdminCollaboration } from "./subscribeAdminCollaboration";
import { useAdminCollaborationController } from "./useAdminCollaborationController";

vi.mock("./loadAdminCollaborationSession", () => ({
  loadAdminCollaborationSession: vi.fn(),
}));

vi.mock("./subscribeAdminCollaboration", () => ({
  subscribeAdminCollaboration: vi.fn(),
}));

const loadAdminCollaborationSessionMock = vi.mocked(loadAdminCollaborationSession);
const subscribeAdminCollaborationMock = vi.mocked(subscribeAdminCollaboration);

function buildSession(ownerId = "shot-live-1") {
  return {
    session: {
      sessionId: `session-${ownerId}`,
      ownerType: ownerId.startsWith("project-") ? "project" : "shot",
      ownerId,
      draftVersion: 4,
      lockHolderUserId: "user-demo-001",
      leaseExpiresAt: "2026-03-23T08:00:00.000Z",
      conflictSummary: "",
      createdAt: "2026-03-23T07:55:00.000Z",
      updatedAt: "2026-03-23T07:59:00.000Z",
    },
    presences: [],
    scope: {
      organizationId: "org-demo-001",
      projectId: "project-live-001",
    },
    alerts: [],
  };
}

describe("useAdminCollaborationController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminCollaborationSessionMock.mockResolvedValue(buildSession());
    subscribeAdminCollaborationMock.mockReturnValue(vi.fn());
  });

  it("loads and subscribes only when the route is enabled and the session is ready", async () => {
    const { result, rerender } = renderHook(
      (props: {
        sessionState: "loading" | "ready" | "unauthenticated";
        enabled: boolean;
      }) =>
        useAdminCollaborationController({
          ...props,
          projectId: "project-live-001",
          shotId: "shot-live-1",
          effectiveOrgId: "org-demo-001",
          effectiveUserId: "user-demo-001",
          t,
        }),
      {
        initialProps: {
          sessionState: "loading",
          enabled: false,
        },
      },
    );

    expect(loadAdminCollaborationSessionMock).not.toHaveBeenCalled();
    expect(subscribeAdminCollaborationMock).not.toHaveBeenCalled();

    rerender({
      sessionState: "ready",
      enabled: true,
    });

    await waitFor(() => {
      expect(result.current.collaborationSession?.session.ownerId).toBe("shot-live-1");
    });

    expect(loadAdminCollaborationSessionMock).toHaveBeenCalledWith({
      ownerType: "shot",
      ownerId: "shot-live-1",
      projectId: "project-live-001",
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(subscribeAdminCollaborationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-demo-001",
        projectId: "project-live-001",
        ownerType: "shot",
        ownerId: "shot-live-1",
      }),
    );
  });

  it("queues a silent refresh when a collaboration event arrives", async () => {
    let onRefreshNeeded: (() => void) | undefined;
    subscribeAdminCollaborationMock.mockImplementation((options) => {
      onRefreshNeeded = options.onRefreshNeeded;
      return vi.fn();
    });

    const { result } = renderHook(() =>
      useAdminCollaborationController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-live-001",
        shotId: "shot-live-1",
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.collaborationSession?.session.ownerId).toBe("shot-live-1");
    });

    loadAdminCollaborationSessionMock.mockResolvedValueOnce(buildSession("shot-live-2"));

    act(() => {
      onRefreshNeeded?.();
    });

    await waitFor(() => {
      expect(loadAdminCollaborationSessionMock).toHaveBeenCalledTimes(2);
    });
  });
});
