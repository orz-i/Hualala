import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAdminAudioWorkbench, type AdminAudioWorkbenchViewModel } from "./adminAudio";

type LoadAdminAudioWorkbenchOptions = {
  projectId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetAudioWorkbenchResponse = {
  timeline?: {
    audioTimelineId?: string;
    projectId?: string;
    episodeId?: string;
    status?: string;
    renderWorkflowRunId?: string;
    renderStatus?: string;
    createdAt?: string;
    updatedAt?: string;
    tracks?: Array<{
      trackId?: string;
      timelineId?: string;
      trackType?: string;
      displayName?: string;
      sequence?: number;
      muted?: boolean;
      solo?: boolean;
      volumePercent?: number;
      clips?: Array<{
        clipId?: string;
        trackId?: string;
        assetId?: string;
        sourceRunId?: string;
        sequence?: number;
        startMs?: number;
        durationMs?: number;
        trimInMs?: number;
        trimOutMs?: number;
      }>;
    }>;
  };
};

export async function loadAdminAudioWorkbench({
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminAudioWorkbenchOptions): Promise<AdminAudioWorkbenchViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.getAudioWorkbench({
    projectId,
  })) as GetAudioWorkbenchResponse;

  return normalizeAdminAudioWorkbench(
    payload.timeline,
    "admin: audio workbench payload is incomplete",
  );
}
