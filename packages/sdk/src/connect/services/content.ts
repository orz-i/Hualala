import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  CreateContentSnapshotResponse,
  CreateLocalizedSnapshotResponse,
  GetCollaborationSessionResponse,
  GetSceneResponse,
  GetShotResponse,
  ListSceneShotsResponse,
  ListScenesResponse,
  ReleaseCollaborationLeaseResponse,
  UpsertCollaborationLeaseResponse,
} from "../../gen/hualala/content/v1/content_pb";
import {
  CreateContentSnapshotResponseSchema,
  CreateLocalizedSnapshotResponseSchema,
  GetCollaborationSessionResponseSchema,
  GetSceneResponseSchema,
  GetShotResponseSchema,
  ListSceneShotsResponseSchema,
  ListScenesResponseSchema,
  ReleaseCollaborationLeaseResponseSchema,
  UpsertCollaborationLeaseResponseSchema,
} from "../../gen/hualala/content/v1/content_pb";

function asJsonValue(response: Record<string, unknown>): JsonValue {
  return response as JsonValue;
}

export function createContentClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);
  const unaryWithSchema = <TResponse>(
    schema: Parameters<typeof fromJson>[0],
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<TResponse> =>
    client
      .unary<Record<string, unknown>>(path, body, label)
      .then((response) => fromJson(schema, asJsonValue(response)) as TResponse);

  return {
    listScenes(body: {
      projectId: string;
      episodeId: string;
      displayLocale?: string;
    }): Promise<ListScenesResponse> {
      return unaryWithSchema<ListScenesResponse>(
        ListScenesResponseSchema,
        "/hualala.content.v1.ContentService/ListScenes",
        body,
        "sdk: failed to list scenes",
      );
    },
    getScene(body: {
      sceneId: string;
      displayLocale?: string;
    }): Promise<GetSceneResponse> {
      return unaryWithSchema<GetSceneResponse>(
        GetSceneResponseSchema,
        "/hualala.content.v1.ContentService/GetScene",
        body,
        "sdk: failed to get scene",
      );
    },
    listSceneShots(body: {
      sceneId: string;
      displayLocale?: string;
    }): Promise<ListSceneShotsResponse> {
      return unaryWithSchema<ListSceneShotsResponse>(
        ListSceneShotsResponseSchema,
        "/hualala.content.v1.ContentService/ListSceneShots",
        body,
        "sdk: failed to list scene shots",
      );
    },
    getShot(body: {
      shotId: string;
      displayLocale?: string;
    }): Promise<GetShotResponse> {
      return unaryWithSchema<GetShotResponse>(
        GetShotResponseSchema,
        "/hualala.content.v1.ContentService/GetShot",
        body,
        "sdk: failed to get shot",
      );
    },
    createContentSnapshot(body: {
      ownerType: string;
      ownerId: string;
      contentLocale: string;
      snapshotKind?: string;
      body: string;
    }): Promise<CreateContentSnapshotResponse> {
      return unaryWithSchema<CreateContentSnapshotResponse>(
        CreateContentSnapshotResponseSchema,
        "/hualala.content.v1.ContentService/CreateContentSnapshot",
        body,
        "sdk: failed to create content snapshot",
      );
    },
    createLocalizedSnapshot(body: {
      sourceSnapshotId: string;
      contentLocale: string;
      snapshotKind?: string;
      body: string;
    }): Promise<CreateLocalizedSnapshotResponse> {
      return unaryWithSchema<CreateLocalizedSnapshotResponse>(
        CreateLocalizedSnapshotResponseSchema,
        "/hualala.content.v1.ContentService/CreateLocalizedSnapshot",
        body,
        "sdk: failed to create localized snapshot",
      );
    },
    getCollaborationSession(body: {
      ownerType: string;
      ownerId: string;
    }): Promise<GetCollaborationSessionResponse> {
      return unaryWithSchema<GetCollaborationSessionResponse>(
        GetCollaborationSessionResponseSchema,
        "/hualala.content.v1.ContentService/GetCollaborationSession",
        body,
        "sdk: failed to get collaboration session",
      );
    },
    upsertCollaborationLease(body: {
      ownerType: string;
      ownerId: string;
      actorUserId: string;
      presenceStatus?: string;
      draftVersion?: number;
      leaseTtlSeconds?: number;
    }): Promise<UpsertCollaborationLeaseResponse> {
      return unaryWithSchema<UpsertCollaborationLeaseResponse>(
        UpsertCollaborationLeaseResponseSchema,
        "/hualala.content.v1.ContentService/UpsertCollaborationLease",
        body,
        "sdk: failed to upsert collaboration lease",
      );
    },
    releaseCollaborationLease(body: {
      ownerType: string;
      ownerId: string;
      actorUserId: string;
      conflictSummary?: string;
    }): Promise<ReleaseCollaborationLeaseResponse> {
      return unaryWithSchema<ReleaseCollaborationLeaseResponse>(
        ReleaseCollaborationLeaseResponseSchema,
        "/hualala.content.v1.ContentService/ReleaseCollaborationLease",
        body,
        "sdk: failed to release collaboration lease",
      );
    },
  };
}

export type ContentClient = ReturnType<typeof createContentClient>;

export type ContentUnaryResponses = {
  listScenes: ListScenesResponse;
  getScene: GetSceneResponse;
  listSceneShots: ListSceneShotsResponse;
  getShot: GetShotResponse;
  createContentSnapshot: CreateContentSnapshotResponse;
  createLocalizedSnapshot: CreateLocalizedSnapshotResponse;
  getCollaborationSession: GetCollaborationSessionResponse;
  upsertCollaborationLease: UpsertCollaborationLeaseResponse;
  releaseCollaborationLease: ReleaseCollaborationLeaseResponse;
};
