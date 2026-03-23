import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  GetCollaborationSessionResponse,
  ReleaseCollaborationLeaseResponse,
  UpsertCollaborationLeaseResponse,
} from "../../gen/hualala/content/v1/content_pb";

export function createContentClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);
  return {
    getCollaborationSession(body: {
      ownerType: string;
      ownerId: string;
    }): Promise<GetCollaborationSessionResponse> {
      return client.unary<GetCollaborationSessionResponse>(
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
      return client.unary<UpsertCollaborationLeaseResponse>(
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
      return client.unary<ReleaseCollaborationLeaseResponse>(
        "/hualala.content.v1.ContentService/ReleaseCollaborationLease",
        body,
        "sdk: failed to release collaboration lease",
      );
    },
  };
}

export type ContentClient = ReturnType<typeof createContentClient>;

export type ContentUnaryResponses = {
  getCollaborationSession: GetCollaborationSessionResponse;
  upsertCollaborationLease: UpsertCollaborationLeaseResponse;
  releaseCollaborationLease: ReleaseCollaborationLeaseResponse;
};
