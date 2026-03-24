import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import {
  normalizeAudioWorkbench,
  resequenceAudioClips,
  resequenceAudioTracks,
  type AudioTrackViewModel,
  type AudioWorkbenchViewModel,
} from "./audioWorkbench";

type SaveAudioWorkbenchOptions = {
  projectId: string;
  status?: string;
  renderWorkflowRunId?: string;
  renderStatus?: string;
  tracks: AudioTrackViewModel[];
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type UpsertAudioTimelineResponse = {
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

function normalizeMutationTracks(tracks: AudioTrackViewModel[]) {
  return resequenceAudioTracks(tracks).map((track, trackIndex) => ({
    trackId: track.trackId.startsWith("draft-track-") ? undefined : track.trackId,
    timelineId: track.timelineId || undefined,
    trackType: track.trackType,
    displayName: track.displayName || undefined,
    sequence: trackIndex + 1,
    muted: track.muted,
    solo: track.solo,
    volumePercent: track.volumePercent,
    clips: resequenceAudioClips(track.clips).map((clip, clipIndex) => ({
      clipId: clip.clipId.startsWith("draft-clip-") ? undefined : clip.clipId,
      trackId: clip.trackId.startsWith("draft-track-") ? undefined : clip.trackId,
      assetId: clip.assetId,
      sourceRunId: clip.sourceRunId || undefined,
      sequence: clipIndex + 1,
      startMs: clip.startMs,
      durationMs: clip.durationMs,
      trimInMs: clip.trimInMs,
      trimOutMs: clip.trimOutMs,
    })),
  }));
}

export async function saveAudioWorkbench({
  projectId,
  status = "draft",
  renderWorkflowRunId,
  renderStatus,
  tracks,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: SaveAudioWorkbenchOptions): Promise<AudioWorkbenchViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.upsertAudioTimeline({
    projectId,
    status,
    renderWorkflowRunId,
    renderStatus,
    tracks: normalizeMutationTracks(tracks),
  })) as UpsertAudioTimelineResponse;

  return normalizeAudioWorkbench(
    payload.timeline,
    "creator: audio workbench payload is incomplete",
  );
}
