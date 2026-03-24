export type AudioTimelineViewModel = {
  audioTimelineId: string;
  projectId: string;
  episodeId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type AudioClipViewModel = {
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

export type AudioTrackViewModel = {
  trackId: string;
  timelineId: string;
  trackType: string;
  displayName: string;
  sequence: number;
  muted: boolean;
  solo: boolean;
  volumePercent: number;
  clips: AudioClipViewModel[];
};

export type AudioWorkbenchSummaryViewModel = {
  trackCount: number;
  clipCount: number;
  missingDurationClipCount: number;
};

export type AudioWorkbenchViewModel = {
  timeline: AudioTimelineViewModel;
  tracks: AudioTrackViewModel[];
  summary: AudioWorkbenchSummaryViewModel;
};

export type AudioAssetPoolItemViewModel = {
  assetId: string;
  importBatchId: string;
  durationMs: number;
  sourceRunId: string;
  fileName: string;
  mediaType: string;
  sourceType: string;
  rightsStatus: string;
  locale: string;
  variantId: string;
  variantType: string;
  mimeType: string;
};

export type PreviewAudioSummaryViewModel = {
  trackCount: number;
  clipCount: number;
  renderStatus: string;
  missingAssetCount: number;
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

export const AUDIO_TRACK_TYPE_ORDER = ["dialogue", "voiceover", "bgm"] as const;

const AUDIO_TRACK_DISPLAY_NAMES: Record<(typeof AUDIO_TRACK_TYPE_ORDER)[number], string> = {
  dialogue: "对白",
  voiceover: "旁白",
  bgm: "配乐",
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

export function getAudioTrackDisplayName(trackType: string) {
  if (trackType in AUDIO_TRACK_DISPLAY_NAMES) {
    return AUDIO_TRACK_DISPLAY_NAMES[trackType as keyof typeof AUDIO_TRACK_DISPLAY_NAMES];
  }
  return trackType || "音轨";
}

export function resequenceAudioClips(clips: AudioClipViewModel[]) {
  return clips.map((clip, index) => ({
    ...clip,
    sequence: index + 1,
  }));
}

export function resequenceAudioTracks(tracks: AudioTrackViewModel[]) {
  return tracks.map((track, index) => ({
    ...track,
    sequence: index + 1,
    clips: resequenceAudioClips(track.clips),
  }));
}

function buildAudioWorkbenchSummary(tracks: AudioTrackViewModel[]): AudioWorkbenchSummaryViewModel {
  const clipCount = tracks.reduce((total, track) => total + track.clips.length, 0);
  const missingDurationClipCount = tracks.reduce(
    (total, track) => total + track.clips.filter((clip) => clip.durationMs <= 0).length,
    0,
  );

  return {
    trackCount: tracks.length,
    clipCount,
    missingDurationClipCount,
  };
}

export function buildPreviewAudioSummary(
  audioWorkbench: AudioWorkbenchViewModel | null,
): PreviewAudioSummaryViewModel | null {
  if (!audioWorkbench) {
    return null;
  }

  return {
    trackCount: audioWorkbench.summary.trackCount,
    clipCount: audioWorkbench.summary.clipCount,
    renderStatus: audioWorkbench.timeline.renderStatus,
    missingAssetCount: audioWorkbench.tracks.reduce(
      (total, track) => total + track.clips.filter((clip) => !clip.assetId).length,
      0,
    ),
  };
}

export function createDefaultAudioTrack(
  timelineId: string,
  trackType: (typeof AUDIO_TRACK_TYPE_ORDER)[number],
  sequence: number,
): AudioTrackViewModel {
  return {
    trackId: `draft-track-${trackType}`,
    timelineId,
    trackType,
    displayName: getAudioTrackDisplayName(trackType),
    sequence,
    muted: false,
    solo: false,
    volumePercent: 100,
    clips: [],
  };
}

export function seedDraftTracks(
  audioWorkbench: AudioWorkbenchViewModel,
): AudioTrackViewModel[] {
  const orderedExistingTracks = [...audioWorkbench.tracks].sort((left, right) => left.sequence - right.sequence);
  const builtInTracksByType = new Map<string, AudioTrackViewModel[]>();
  const customTracks: AudioTrackViewModel[] = [];

  orderedExistingTracks.forEach((track) => {
    if (AUDIO_TRACK_TYPE_ORDER.includes(track.trackType as never)) {
      const group = builtInTracksByType.get(track.trackType) ?? [];
      group.push(track);
      builtInTracksByType.set(track.trackType, group);
      return;
    }
    customTracks.push(track);
  });

  const orderedTracks: AudioTrackViewModel[] = [];

  AUDIO_TRACK_TYPE_ORDER.forEach((trackType) => {
    const existingTracks = builtInTracksByType.get(trackType) ?? [];
    if (existingTracks.length > 0) {
      orderedTracks.push(...existingTracks);
      return;
    }
    orderedTracks.push(
      createDefaultAudioTrack(audioWorkbench.timeline.audioTimelineId, trackType, orderedTracks.length + 1),
    );
  });

  customTracks.forEach((track) => {
    orderedTracks.push(track);
  });

  return resequenceAudioTracks(orderedTracks);
}

export function normalizeAudioWorkbench(
  timeline: AudioTimelinePayload | undefined,
  errorMessage: string,
): AudioWorkbenchViewModel {
  if (!timeline?.audioTimelineId || !timeline.projectId) {
    throw new Error(errorMessage);
  }

  const normalizedTimeline: AudioTimelineViewModel = {
    audioTimelineId: timeline.audioTimelineId,
    projectId: timeline.projectId,
    episodeId: timeline.episodeId ?? "",
    status: timeline.status ?? "draft",
    renderWorkflowRunId: timeline.renderWorkflowRunId ?? "",
    renderStatus: timeline.renderStatus ?? "pending",
    createdAt: timeline.createdAt ?? "",
    updatedAt: timeline.updatedAt ?? "",
  };

  const normalizedTracks = resequenceAudioTracks(
    [...(timeline.tracks ?? [])]
      .sort((left, right) => {
        const leftSequence = normalizeSequence(left.sequence, Number.MAX_SAFE_INTEGER);
        const rightSequence = normalizeSequence(right.sequence, Number.MAX_SAFE_INTEGER);
        return leftSequence - rightSequence;
      })
      .map((track, trackIndex) => ({
        trackId: track.trackId ?? `${normalizedTimeline.audioTimelineId}-track-${trackIndex + 1}`,
        timelineId: track.timelineId ?? normalizedTimeline.audioTimelineId,
        trackType: track.trackType ?? AUDIO_TRACK_TYPE_ORDER[trackIndex] ?? "dialogue",
        displayName: track.displayName ?? getAudioTrackDisplayName(track.trackType ?? "dialogue"),
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
      })),
  );

  return {
    timeline: normalizedTimeline,
    tracks: normalizedTracks,
    summary: buildAudioWorkbenchSummary(normalizedTracks),
  };
}
