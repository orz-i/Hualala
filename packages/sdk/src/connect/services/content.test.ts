import { describe, expect, it, vi } from "vitest";
import { createContentClient } from "./content";

describe("createContentClient", () => {
  it("calls collaboration unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              sessionId: "session-1",
              ownerType: "shot",
              ownerId: "shot-1",
              draftVersion: 3,
              lockHolderUserId: "user-1",
              conflictSummary: "",
              presences: [
                {
                  presenceId: "presence-1",
                  sessionId: "session-1",
                  userId: "user-1",
                  status: "editing",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              sessionId: "session-1",
              ownerType: "shot",
              ownerId: "shot-1",
              draftVersion: 4,
              lockHolderUserId: "user-1",
              presences: [
                {
                  presenceId: "presence-1",
                  sessionId: "session-1",
                  userId: "user-1",
                  status: "editing",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              sessionId: "session-1",
              ownerType: "shot",
              ownerId: "shot-1",
              draftVersion: 4,
              lockHolderUserId: "",
              presences: [
                {
                  presenceId: "presence-1",
                  sessionId: "session-1",
                  userId: "user-1",
                  status: "released",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const client = createContentClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        userId: "user-1",
      },
    });

    await client.getCollaborationSession({
      ownerType: "shot",
      ownerId: "shot-1",
    });
    await client.upsertCollaborationLease({
      ownerType: "shot",
      ownerId: "shot-1",
      actorUserId: "user-1",
      presenceStatus: "editing",
      draftVersion: 4,
      leaseTtlSeconds: 120,
    });
    await client.releaseCollaborationLease({
      ownerType: "shot",
      ownerId: "shot-1",
      actorUserId: "user-1",
      conflictSummary: "",
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/GetCollaborationSession",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-User-Id": "user-1",
        }),
        body: JSON.stringify({
          ownerType: "shot",
          ownerId: "shot-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/UpsertCollaborationLease",
      expect.objectContaining({
        body: JSON.stringify({
          ownerType: "shot",
          ownerId: "shot-1",
          actorUserId: "user-1",
          presenceStatus: "editing",
          draftVersion: 4,
          leaseTtlSeconds: 120,
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/ReleaseCollaborationLease",
      expect.objectContaining({
        body: JSON.stringify({
          ownerType: "shot",
          ownerId: "shot-1",
          actorUserId: "user-1",
          conflictSummary: "",
        }),
      }),
    );
  });
});
