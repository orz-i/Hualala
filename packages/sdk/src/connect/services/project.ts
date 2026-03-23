import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  GetAudioWorkbenchResponse,
  GetPreviewWorkbenchResponse,
  UpsertAudioTimelineResponse,
  UpsertPreviewAssemblyResponse,
} from "../../gen/hualala/project/v1/project_service_pb";

export function createProjectClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);
  return {
    getPreviewWorkbench(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetPreviewWorkbenchResponse> {
      return client.unary<GetPreviewWorkbenchResponse>(
        "/hualala.project.v1.ProjectService/GetPreviewWorkbench",
        body,
        "sdk: failed to get preview workbench",
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
      return client.unary<UpsertPreviewAssemblyResponse>(
        "/hualala.project.v1.ProjectService/UpsertPreviewAssembly",
        body,
        "sdk: failed to upsert preview assembly",
      );
    },
    getAudioWorkbench(body: {
      projectId: string;
      episodeId?: string;
    }): Promise<GetAudioWorkbenchResponse> {
      return client.unary<GetAudioWorkbenchResponse>(
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
      return client.unary<UpsertAudioTimelineResponse>(
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
  upsertPreviewAssembly: UpsertPreviewAssemblyResponse;
  getAudioWorkbench: GetAudioWorkbenchResponse;
  upsertAudioTimeline: UpsertAudioTimelineResponse;
};
