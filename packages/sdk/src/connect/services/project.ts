import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  ApplyAudioRenderUpdateResponse,
  ApplyPreviewRenderUpdateResponse,
  GetAudioRuntimeResponse,
  GetAudioWorkbenchResponse,
  GetPreviewRuntimeResponse,
  GetPreviewWorkbenchResponse,
  ListPreviewShotOptionsResponse,
  RequestAudioRenderResponse,
  RequestPreviewRenderResponse,
  UpsertAudioTimelineResponse,
  UpsertPreviewAssemblyResponse,
} from "../../gen/hualala/project/v1/project_service_pb";
import {
  ApplyAudioRenderUpdateResponseSchema,
  ApplyPreviewRenderUpdateResponseSchema,
  GetAudioRuntimeResponseSchema,
  GetAudioWorkbenchResponseSchema,
  GetPreviewRuntimeResponseSchema,
  GetPreviewWorkbenchResponseSchema,
  ListPreviewShotOptionsResponseSchema,
  RequestAudioRenderResponseSchema,
  RequestPreviewRenderResponseSchema,
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
    getPreviewRuntime(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetPreviewRuntimeResponse> {
      return unaryWithSchema<GetPreviewRuntimeResponse>(
        GetPreviewRuntimeResponseSchema,
        "/hualala.project.v1.ProjectService/GetPreviewRuntime",
        body,
        "sdk: failed to get preview runtime",
      );
    },
    requestPreviewRender(body: {
      projectId: string;
      episodeId?: string;
      requestedLocale?: string;
    }): Promise<RequestPreviewRenderResponse> {
      return unaryWithSchema<RequestPreviewRenderResponse>(
        RequestPreviewRenderResponseSchema,
        "/hualala.project.v1.ProjectService/RequestPreviewRender",
        body,
        "sdk: failed to request preview render",
      );
    },
    applyPreviewRenderUpdate(body: {
      previewRuntimeId: string;
      renderWorkflowRunId: string;
      renderStatus: string;
      resolvedLocale?: string;
      playbackAssetId?: string;
      exportAssetId?: string;
      playback?: {
        deliveryMode?: string;
        playbackUrl?: string;
        posterUrl?: string;
        durationMs?: number;
        timeline?: {
          segments?: Array<{
            segmentId?: string;
            sequence?: number;
            shotId?: string;
            shotCode?: string;
            shotTitle?: string;
            playbackAssetId?: string;
            sourceRunId?: string;
            startMs?: number;
            durationMs?: number;
            transitionToNext?: {
              transitionType?: string;
              durationMs?: number;
            };
          }>;
          totalDurationMs?: number;
        };
      };
      exportOutput?: {
        downloadUrl?: string;
        mimeType?: string;
        fileName?: string;
        sizeBytes?: number;
      };
      errorCode?: string;
      errorMessage?: string;
    }): Promise<ApplyPreviewRenderUpdateResponse> {
      return unaryWithSchema<ApplyPreviewRenderUpdateResponse>(
        ApplyPreviewRenderUpdateResponseSchema,
        "/hualala.project.v1.ProjectService/ApplyPreviewRenderUpdate",
        body,
        "sdk: failed to apply preview render update",
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
    getAudioRuntime(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetAudioRuntimeResponse> {
      return unaryWithSchema<GetAudioRuntimeResponse>(
        GetAudioRuntimeResponseSchema,
        "/hualala.project.v1.ProjectService/GetAudioRuntime",
        body,
        "sdk: failed to get audio runtime",
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
    requestAudioRender(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<RequestAudioRenderResponse> {
      return unaryWithSchema<RequestAudioRenderResponse>(
        RequestAudioRenderResponseSchema,
        "/hualala.project.v1.ProjectService/RequestAudioRender",
        body,
        "sdk: failed to request audio render",
      );
    },
    applyAudioRenderUpdate(body: {
      audioRuntimeId: string;
      renderWorkflowRunId: string;
      renderStatus: string;
      mixAssetId?: string;
      mixOutput?: {
        deliveryMode?: string;
        playbackUrl?: string;
        downloadUrl?: string;
        mimeType?: string;
        fileName?: string;
        sizeBytes?: number;
        durationMs?: number;
      };
      waveforms?: Array<{
        assetId?: string;
        variantId?: string;
        waveformUrl?: string;
        mimeType?: string;
        durationMs?: number;
      }>;
      errorCode?: string;
      errorMessage?: string;
    }): Promise<ApplyAudioRenderUpdateResponse> {
      return unaryWithSchema<ApplyAudioRenderUpdateResponse>(
        ApplyAudioRenderUpdateResponseSchema,
        "/hualala.project.v1.ProjectService/ApplyAudioRenderUpdate",
        body,
        "sdk: failed to apply audio render update",
      );
    },
  };
}

export type ProjectClient = ReturnType<typeof createProjectClient>;

export type ProjectUnaryResponses = {
  getPreviewWorkbench: GetPreviewWorkbenchResponse;
  listPreviewShotOptions: ListPreviewShotOptionsResponse;
  upsertPreviewAssembly: UpsertPreviewAssemblyResponse;
  getPreviewRuntime: GetPreviewRuntimeResponse;
  requestPreviewRender: RequestPreviewRenderResponse;
  applyPreviewRenderUpdate: ApplyPreviewRenderUpdateResponse;
  getAudioWorkbench: GetAudioWorkbenchResponse;
  getAudioRuntime: GetAudioRuntimeResponse;
  upsertAudioTimeline: UpsertAudioTimelineResponse;
  requestAudioRender: RequestAudioRenderResponse;
  applyAudioRenderUpdate: ApplyAudioRenderUpdateResponse;
};
