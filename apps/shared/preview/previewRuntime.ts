export type PreviewTransitionViewModel = {
  transitionType: string;
  durationMs: number;
};

export type PreviewTimelineSegmentViewModel = {
  segmentId: string;
  sequence: number;
  shotId: string;
  shotCode: string;
  shotTitle: string;
  playbackAssetId: string;
  sourceRunId: string;
  startMs: number;
  durationMs: number;
  transitionToNext: PreviewTransitionViewModel | null;
};

export type PreviewTimelineSpineViewModel = {
  totalDurationMs: number;
  segments: PreviewTimelineSegmentViewModel[];
};

export type PreviewPlaybackDeliveryViewModel = {
  deliveryMode: string;
  playbackUrl: string;
  posterUrl: string;
  durationMs: number;
  timeline: PreviewTimelineSpineViewModel | null;
};

export type PreviewExportDeliveryViewModel = {
  downloadUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

export type PreviewRuntimeViewModel = {
  previewRuntimeId: string;
  projectId: string;
  episodeId: string;
  assemblyId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  playbackAssetId: string;
  exportAssetId: string;
  resolvedLocale: string;
  createdAt: string;
  updatedAt: string;
  playback: PreviewPlaybackDeliveryViewModel | null;
  exportOutput: PreviewExportDeliveryViewModel | null;
  lastErrorCode: string;
  lastErrorMessage: string;
};

export type PreviewRuntimePayload = {
  previewRuntimeId?: string;
  projectId?: string;
  episodeId?: string;
  assemblyId?: string;
  status?: string;
  renderWorkflowRunId?: string;
  renderStatus?: string;
  playbackAssetId?: string;
  exportAssetId?: string;
  resolvedLocale?: string;
  createdAt?: string;
  updatedAt?: string;
  playback?: {
    deliveryMode?: string;
    playbackUrl?: string;
    posterUrl?: string;
    durationMs?: number;
    timeline?: {
      totalDurationMs?: number;
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
    } | null;
  };
  exportOutput?: {
    downloadUrl?: string;
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
  };
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

function normalizeTransition(
  transition: {
    transitionType?: string;
    durationMs?: number;
  } | null | undefined,
): PreviewTransitionViewModel | null {
  if (!transition) {
    return null;
  }

  return {
    transitionType: transition.transitionType ?? "",
    durationMs: transition.durationMs ?? 0,
  };
}

function normalizeTimeline(
  timeline: PreviewRuntimePayload["playback"] extends infer Playback
    ? Playback extends { timeline?: infer Timeline }
      ? Timeline
      : never
    : never,
): PreviewTimelineSpineViewModel | null {
  if (!timeline) {
    return null;
  }

  return {
    totalDurationMs: timeline.totalDurationMs ?? 0,
    segments: [...(timeline.segments ?? [])]
      .map((segment) => ({
        segmentId: segment.segmentId ?? "",
        sequence: segment.sequence ?? 0,
        shotId: segment.shotId ?? "",
        shotCode: segment.shotCode ?? "",
        shotTitle: segment.shotTitle ?? "",
        playbackAssetId: segment.playbackAssetId ?? "",
        sourceRunId: segment.sourceRunId ?? "",
        startMs: segment.startMs ?? 0,
        durationMs: segment.durationMs ?? 0,
        transitionToNext: normalizeTransition(segment.transitionToNext),
      }))
      .sort((left, right) => left.sequence - right.sequence),
  };
}

function normalizePlayback(
  playback: PreviewRuntimePayload["playback"],
): PreviewPlaybackDeliveryViewModel | null {
  if (!playback) {
    return null;
  }
  return {
    deliveryMode: playback.deliveryMode ?? "",
    playbackUrl: playback.playbackUrl ?? "",
    posterUrl: playback.posterUrl ?? "",
    durationMs: playback.durationMs ?? 0,
    timeline: normalizeTimeline(playback.timeline),
  };
}

function normalizeExportOutput(
  exportOutput: PreviewRuntimePayload["exportOutput"],
): PreviewExportDeliveryViewModel | null {
  if (!exportOutput) {
    return null;
  }
  return {
    downloadUrl: exportOutput.downloadUrl ?? "",
    mimeType: exportOutput.mimeType ?? "",
    fileName: exportOutput.fileName ?? "",
    sizeBytes: exportOutput.sizeBytes ?? 0,
  };
}

export function normalizePreviewRuntime(
  payload: PreviewRuntimePayload | undefined,
  errorMessage: string,
): PreviewRuntimeViewModel {
  if (!payload?.previewRuntimeId || !payload.projectId) {
    throw new Error(errorMessage);
  }

  return {
    previewRuntimeId: payload.previewRuntimeId,
    projectId: payload.projectId,
    episodeId: payload.episodeId ?? "",
    assemblyId: payload.assemblyId ?? "",
    status: payload.status ?? "",
    renderWorkflowRunId: payload.renderWorkflowRunId ?? "",
    renderStatus: payload.renderStatus ?? "",
    playbackAssetId: payload.playbackAssetId ?? "",
    exportAssetId: payload.exportAssetId ?? "",
    resolvedLocale: payload.resolvedLocale ?? "",
    createdAt: payload.createdAt ?? "",
    updatedAt: payload.updatedAt ?? "",
    playback: normalizePlayback(payload.playback),
    exportOutput: normalizeExportOutput(payload.exportOutput),
    lastErrorCode: payload.lastErrorCode ?? "",
    lastErrorMessage: payload.lastErrorMessage ?? "",
  };
}
