export type AdminAudioTimelineViewModel = {
  audioTimelineId: string;
  projectId: string;
  episodeId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAudioClipViewModel = {
  clipId: string;
  trackId: string;
  assetId: string;
  sourceRunId: string;
  sequence: number;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
};

export type AdminAudioTrackViewModel = {
  trackId: string;
  timelineId: string;
  trackType: string;
  displayName: string;
  sequence: number;
  muted: boolean;
  solo: boolean;
  volumePercent: number;
  clips: AdminAudioClipViewModel[];
};

export type AdminAudioWorkbenchViewModel = {
  timeline: AdminAudioTimelineViewModel;
  tracks: AdminAudioTrackViewModel[];
  summary: {
    trackCount: number;
    clipCount: number;
    missingAssetCount: number;
    invalidTimingClipCount: number;
    tracksByType: Array<{
      trackType: string;
      count: number;
    }>;
  };
};

type AudioTimelinePayload = {
  audioTimelineId?: string;
  projectId?: string;
  episodeId?: string;
  status?: string;
  renderWorkflowRunId?: string;
  renderStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  tracks?: AudioTrackPayload[];
};

type AudioTrackPayload = {
  trackId?: string;
  timelineId?: string;
  trackType?: string;
  displayName?: string;
  sequence?: number;
  muted?: boolean;
  solo?: boolean;
  volumePercent?: number;
  clips?: AudioClipPayload[];
};

type AudioClipPayload = {
  clipId?: string;
  trackId?: string;
  assetId?: string;
  sourceRunId?: string;
  sequence?: number;
  startMs?: number;
  durationMs?: number;
  trimInMs?: number;
  trimOutMs?: number;
};

function normalizeSequence(value: number | undefined, fallback: number) {
  return typeof value === "number" && value > 0 ? Math.trunc(value) : fallback;
}

function normalizeDuration(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
}

function normalizeVolume(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 100;
  }
  return Math.min(100, Math.trunc(value));
}

function getTrackDisplayName(trackType: string) {
  switch (trackType) {
    case "dialogue":
      return "对白";
    case "voiceover":
      return "旁白";
    case "bgm":
      return "配乐";
    default:
      return trackType || "音轨";
  }
}

export function normalizeAdminAudioWorkbench(
  timeline: AudioTimelinePayload | undefined,
  errorMessage: string,
): AdminAudioWorkbenchViewModel {
  if (!timeline?.audioTimelineId || !timeline.projectId) {
    throw new Error(errorMessage);
  }

  const normalizedTimeline: AdminAudioTimelineViewModel = {
    audioTimelineId: timeline.audioTimelineId,
    projectId: timeline.projectId,
    episodeId: timeline.episodeId ?? "",
    status: timeline.status ?? "draft",
    renderWorkflowRunId: timeline.renderWorkflowRunId ?? "",
    renderStatus: timeline.renderStatus ?? "pending",
    createdAt: timeline.createdAt ?? "",
    updatedAt: timeline.updatedAt ?? "",
  };

  const normalizedTracks = [...(timeline.tracks ?? [])]
    .sort((left, right) => {
      const leftSequence = normalizeSequence(left.sequence, Number.MAX_SAFE_INTEGER);
      const rightSequence = normalizeSequence(right.sequence, Number.MAX_SAFE_INTEGER);
      return leftSequence - rightSequence;
    })
    .map((track, trackIndex) => ({
      trackId: track.trackId ?? `${normalizedTimeline.audioTimelineId}-track-${trackIndex + 1}`,
      timelineId: track.timelineId ?? normalizedTimeline.audioTimelineId,
      trackType: track.trackType ?? "dialogue",
      displayName: track.displayName ?? getTrackDisplayName(track.trackType ?? "dialogue"),
      sequence: trackIndex + 1,
      muted: track.muted ?? false,
      solo: track.solo ?? false,
      volumePercent: normalizeVolume(track.volumePercent),
      clips: [...(track.clips ?? [])]
        .sort((left, right) => {
          const leftSequence = normalizeSequence(left.sequence, Number.MAX_SAFE_INTEGER);
          const rightSequence = normalizeSequence(right.sequence, Number.MAX_SAFE_INTEGER);
          return leftSequence - rightSequence;
        })
        .map((clip, clipIndex) => ({
          clipId: clip.clipId ?? `${track.trackId ?? `track-${trackIndex + 1}`}-clip-${clipIndex + 1}`,
          trackId:
            clip.trackId ??
            track.trackId ??
            `${normalizedTimeline.audioTimelineId}-track-${trackIndex + 1}`,
          assetId: clip.assetId ?? "",
          sourceRunId: clip.sourceRunId ?? "",
          sequence: clipIndex + 1,
          startMs: normalizeDuration(clip.startMs),
          durationMs: normalizeDuration(clip.durationMs),
          trimInMs: normalizeDuration(clip.trimInMs),
          trimOutMs: normalizeDuration(clip.trimOutMs),
        })),
    }));

  return {
    timeline: normalizedTimeline,
    tracks: normalizedTracks,
    summary: {
      trackCount: normalizedTracks.length,
      clipCount: normalizedTracks.reduce((total, track) => total + track.clips.length, 0),
      missingAssetCount: normalizedTracks.reduce(
        (total, track) => total + track.clips.filter((clip) => !clip.assetId).length,
        0,
      ),
      invalidTimingClipCount: normalizedTracks.reduce(
        (total, track) =>
          total +
          track.clips.filter(
            (clip) => clip.durationMs <= 0 || clip.trimOutMs > clip.durationMs,
          ).length,
        0,
      ),
      tracksByType: normalizedTracks.map((track) => ({
        trackType: track.trackType,
        count: track.clips.length,
      })),
    },
  };
}
