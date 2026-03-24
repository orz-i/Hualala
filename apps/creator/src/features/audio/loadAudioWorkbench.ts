import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAudioWorkbench, type AudioWorkbenchViewModel } from "./audioWorkbench";

type LoadAudioWorkbenchOptions = {
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

export async function loadAudioWorkbench({
  projectId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAudioWorkbenchOptions): Promise<AudioWorkbenchViewModel> {
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

  return normalizeAudioWorkbench(
    payload.timeline,
    "creator: audio workbench payload is incomplete",
  );
}
