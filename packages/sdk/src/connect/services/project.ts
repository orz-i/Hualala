import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  GetAudioWorkbenchResponse,
  GetPreviewWorkbenchResponse,
  ListPreviewShotOptionsResponse,
  UpsertAudioTimelineResponse,
  UpsertPreviewAssemblyResponse,
} from "../../gen/hualala/project/v1/project_service_pb";
import {
  GetAudioWorkbenchResponseSchema,
  GetPreviewWorkbenchResponseSchema,
  ListPreviewShotOptionsResponseSchema,
  UpsertAudioTimelineResponseSchema,
  UpsertPreviewAssemblyResponseSchema,
} from "../../gen/hualala/project/v1/project_service_pb";

function asJsonValue(response: Record<string, unknown>): JsonValue {
  return response as JsonValue;
}

export function createProjectClient(options: HualalaClientOptions = {}) {
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
    getPreviewWorkbench(body: {
      projectId: string;
      episodeId?: string;
      displayLocale?: string;
    }): Promise<GetPreviewWorkbenchResponse> {
      return unaryWithSchema<GetPreviewWorkbenchResponse>(
        GetPreviewWorkbenchResponseSchema,
        "/hualala.project.v1.ProjectService/GetPreviewWorkbench",
        body,
        "sdk: failed to get preview workbench",
      );
    },
    listPreviewShotOptions(body: {
      projectId: string;
      episodeId?: string;
      displayLocale?: string;
    }): Promise<ListPreviewShotOptionsResponse> {
      return unaryWithSchema<ListPreviewShotOptionsResponse>(
        ListPreviewShotOptionsResponseSchema,
        "/hualala.project.v1.ProjectService/ListPreviewShotOptions",
        body,
        "sdk: failed to list preview shot options",
      );
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
      return unaryWithSchema<UpsertPreviewAssemblyResponse>(
        UpsertPreviewAssemblyResponseSchema,
        "/hualala.project.v1.ProjectService/UpsertPreviewAssembly",
        body,
        "sdk: failed to upsert preview assembly",
      );
    },
    getAudioWorkbench(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetAudioWorkbenchResponse> {
      return unaryWithSchema<GetAudioWorkbenchResponse>(
        GetAudioWorkbenchResponseSchema,
        "/hualala.project.v1.ProjectService/GetAudioWorkbench",
        body,
        "sdk: failed to get audio workbench",
      );
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
      return unaryWithSchema<UpsertAudioTimelineResponse>(
        UpsertAudioTimelineResponseSchema,
        "/hualala.project.v1.ProjectService/UpsertAudioTimeline",
        body,
        "sdk: failed to upsert audio timeline",
      );
    },
  };
}

export type ProjectClient = ReturnType<typeof createProjectClient>;

export type ProjectUnaryResponses = {
  getPreviewWorkbench: GetPreviewWorkbenchResponse;
  listPreviewShotOptions: ListPreviewShotOptionsResponse;
  upsertPreviewAssembly: UpsertPreviewAssemblyResponse;
  getAudioWorkbench: GetAudioWorkbenchResponse;
  upsertAudioTimeline: UpsertAudioTimelineResponse;
};
