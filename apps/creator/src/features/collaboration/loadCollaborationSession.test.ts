import { createContentClient } from "@hualala/sdk";
import { loadShotWorkbench } from "../shot-workbench/loadShotWorkbench";
import { loadCollaborationSession } from "./loadCollaborationSession";

vi.mock("@hualala/sdk", () => ({
  createContentClient: vi.fn(),
}));

vi.mock("../shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));

const createContentClientMock = vi.mocked(createContentClient);
const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);

describe("loadCollaborationSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads a shot collaboration session and resolves the subscription scope from the shot workbench", async () => {
    const getCollaborationSessionMock = vi.fn().mockResolvedValue({
      session: {
        sessionId: "session-shot-1",
        ownerType: "shot",
        ownerId: "shot-1",
        draftVersion: 4,
        lockHolderUserId: "user-1",
        conflictSummary: "",
        presences: [
          {
            presenceId: "presence-1",
            sessionId: "session-shot-1",
            userId: "user-1",
            status: "editing",
          },
        ],
      },
    });
    createContentClientMock.mockReturnValue({
      getCollaborationSession: getCollaborationSessionMock,
    } as never);
    loadShotWorkbenchMock.mockResolvedValue({
      shotExecution: {
        id: "shot-exec-1",
        shotId: "shot-1",
        orgId: "org-1",
        projectId: "project-1",
        status: "candidate_ready",
        primaryAssetId: "",
      },
      candidateAssets: [],
      reviewSummary: {
        latestConclusion: "pending",
      },
      reviewTimeline: {
        evaluationRuns: [],
        shotReviews: [],
      },
    } as never);

    const result = await loadCollaborationSession({
      ownerType: "shot",
      ownerId: "shot-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createContentClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: undefined,
          userId: "user-1",
        },
      }),
    );
    expect(getCollaborationSessionMock).toHaveBeenCalledWith({
      ownerType: "shot",
      ownerId: "shot-1",
    });
    expect(loadShotWorkbenchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shotId: "shot-1",
        userId: "user-1",
      }),
    );
    expect(result.session.ownerId).toBe("shot-1");
    expect(result.presences).toEqual([
      expect.objectContaining({
        presenceId: "presence-1",
        userId: "user-1",
        status: "editing",
      }),
    ]);
    expect(result.scope).toEqual({
      organizationId: "org-1",
      projectId: "project-1",
    });
  });

  it("uses the project owner id as the subscription scope for project collaboration", async () => {
    const getCollaborationSessionMock = vi.fn().mockResolvedValue({
      session: {
        sessionId: "session-project-1",
        ownerType: "project",
        ownerId: "project-1",
        draftVersion: 2,
        lockHolderUserId: "",
        conflictSummary: "stale lock recovered",
        presences: [],
      },
    });
    createContentClientMock.mockReturnValue({
      getCollaborationSession: getCollaborationSessionMock,
    } as never);

    const result = await loadCollaborationSession({
      ownerType: "project",
      ownerId: "project-1",
      orgId: "org-9",
      userId: "user-9",
      fetchFn: vi.fn(),
    });

    expect(loadShotWorkbenchMock).not.toHaveBeenCalled();
    expect(result.scope).toEqual({
      organizationId: "org-9",
      projectId: "project-1",
    });
    expect(result.session.conflictSummary).toBe("stale lock recovered");
  });
});
