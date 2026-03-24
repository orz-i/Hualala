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

  it("calls localized content unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            scenes: [
              {
                id: "scene-1",
                episodeId: "episode-1",
                code: "SCENE-001",
                title: "Opening",
                sourceLocale: "zh-CN",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            scene: {
              id: "scene-1",
              episodeId: "episode-1",
              code: "SCENE-001",
              title: "Opening",
              sourceLocale: "zh-CN",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            shots: [
              {
                id: "shot-1",
                sceneId: "scene-1",
                code: "SCENE-001-SHOT-001",
                title: "Hero enters",
                sourceLocale: "zh-CN",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            shot: {
              id: "shot-1",
              sceneId: "scene-1",
              code: "SCENE-001-SHOT-001",
              title: "Hero enters",
              sourceLocale: "zh-CN",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            snapshot: {
              id: "snapshot-1",
              ownerType: "shot",
              ownerId: "shot-1",
              snapshotKind: "title",
              locale: "zh-CN",
              translationGroupId: "group-1",
              translationStatus: "source",
              body: "主角入场",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            snapshot: {
              id: "snapshot-2",
              ownerType: "shot",
              ownerId: "shot-1",
              snapshotKind: "title",
              locale: "en-US",
              sourceSnapshotId: "snapshot-1",
              translationGroupId: "group-1",
              translationStatus: "draft_translation",
              body: "Hero enters",
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

    const scenes = await client.listScenes({
      projectId: "project-1",
      episodeId: "episode-1",
      displayLocale: "en-US",
    });
    const scene = await client.getScene({
      sceneId: "scene-1",
      displayLocale: "en-US",
    });
    const shots = await client.listSceneShots({
      sceneId: "scene-1",
      displayLocale: "en-US",
    });
    const shot = await client.getShot({
      shotId: "shot-1",
      displayLocale: "en-US",
    });
    const source = await client.createContentSnapshot({
      ownerType: "shot",
      ownerId: "shot-1",
      contentLocale: "zh-CN",
      snapshotKind: "title",
      body: "主角入场",
    });
    const localized = await client.createLocalizedSnapshot({
      sourceSnapshotId: "snapshot-1",
      contentLocale: "en-US",
      snapshotKind: "title",
      body: "Hero enters",
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/ListScenes",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
          displayLocale: "en-US",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/GetShot",
      expect.objectContaining({
        body: JSON.stringify({
          shotId: "shot-1",
          displayLocale: "en-US",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/CreateContentSnapshot",
      expect.objectContaining({
        body: JSON.stringify({
          ownerType: "shot",
          ownerId: "shot-1",
          contentLocale: "zh-CN",
          snapshotKind: "title",
          body: "主角入场",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:8080/hualala.content.v1.ContentService/CreateLocalizedSnapshot",
      expect.objectContaining({
        body: JSON.stringify({
          sourceSnapshotId: "snapshot-1",
          contentLocale: "en-US",
          snapshotKind: "title",
          body: "Hero enters",
        }),
      }),
    );
    expect(scenes.scenes[0]?.title).toBe("Opening");
    expect(scene.scene?.title).toBe("Opening");
    expect(shots.shots[0]?.title).toBe("Hero enters");
    expect(shot.shot?.title).toBe("Hero enters");
    expect(source.snapshot?.snapshotKind).toBe("title");
    expect(localized.snapshot?.sourceSnapshotId).toBe("snapshot-1");
  });
});
