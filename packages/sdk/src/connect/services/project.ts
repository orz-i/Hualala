import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  GetPreviewWorkbenchResponse,
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
  };
}

export type ProjectClient = ReturnType<typeof createProjectClient>;

export type ProjectUnaryResponses = {
  getPreviewWorkbench: GetPreviewWorkbenchResponse;
  upsertPreviewAssembly: UpsertPreviewAssemblyResponse;
};
