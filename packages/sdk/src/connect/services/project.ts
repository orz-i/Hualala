import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  GetAudioWorkbenchResponse,
  GetPreviewWorkbenchResponse,
  UpsertAudioTimelineResponse,
  UpsertPreviewAssemblyResponse,
} from "../../gen/hualala/project/v1/project_service_pb";
import {
  GetAudioWorkbenchResponseSchema,
  GetPreviewWorkbenchResponseSchema,
  UpsertAudioTimelineResponseSchema,
  UpsertPreviewAssemblyResponseSchema,
} from "../../gen/hualala/project/v1/project_service_pb";

function asJsonValue(response: Record<string, unknown>): JsonValue {
  return response as JsonValue;
}

export function createProjectClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);
  return {
    getPreviewWorkbench(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetPreviewWorkbenchResponse> {
      return client.unary<Record<string, unknown>>(
        "/hualala.project.v1.ProjectService/GetPreviewWorkbench",
        body,
        "sdk: failed to get preview workbench",
      ).then((response) => fromJson(GetPreviewWorkbenchResponseSchema, asJsonValue(response)));
    },
    upsertPreviewAssembly(body: {
      projectId: string;
      episodeId?: string;
      status?: string;
      items: Array<{
        itemId?: string;
        assemblyId?: string;
        shotId: string;
        primaryAssetId?: string;
        sourceRunId?: string;
        sequence?: number;
      }>;
    }): Promise<UpsertPreviewAssemblyResponse> {
      return client.unary<Record<string, unknown>>(
        "/hualala.project.v1.ProjectService/UpsertPreviewAssembly",
        body,
        "sdk: failed to upsert preview assembly",
      ).then((response) => fromJson(UpsertPreviewAssemblyResponseSchema, asJsonValue(response)));
    },
    getAudioWorkbench(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetAudioWorkbenchResponse> {
      return client.unary<Record<string, unknown>>(
        "/hualala.project.v1.ProjectService/GetAudioWorkbench",
        body,
        "sdk: failed to get audio workbench",
      ).then((response) => fromJson(GetAudioWorkbenchResponseSchema, asJsonValue(response)));
    },
    upsertAudioTimeline(body: {
      projectId: string;
      episodeId?: string;
      status?: string;
      renderWorkflowRunId?: string;
      renderStatus?: string;
      tracks: Array<{
        trackId?: string;
        timelineId?: string;
        trackType: string;
        displayName?: string;
        sequence?: number;
        muted?: boolean;
        solo?: boolean;
        volumePercent?: number;
        clips?: Array<{
          clipId?: string;
          trackId?: string;
          assetId: string;
          sourceRunId?: string;
          sequence?: number;
          startMs?: number;
          durationMs?: number;
          trimInMs?: number;
          trimOutMs?: number;
        }>;
      }>;
    }): Promise<UpsertAudioTimelineResponse> {
      return client.unary<Record<string, unknown>>(
        "/hualala.project.v1.ProjectService/UpsertAudioTimeline",
        body,
        "sdk: failed to upsert audio timeline",
      ).then((response) => fromJson(UpsertAudioTimelineResponseSchema, asJsonValue(response)));
    },
  };
}

export type ProjectClient = ReturnType<typeof createProjectClient>;

export type ProjectUnaryResponses = {
  getPreviewWorkbench: GetPreviewWorkbenchResponse;
  upsertPreviewAssembly: UpsertPreviewAssemblyResponse;
  getAudioWorkbench: GetAudioWorkbenchResponse;
  upsertAudioTimeline: UpsertAudioTimelineResponse;
};
