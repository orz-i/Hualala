export type PreviewPlaybackDeliveryViewModel = {
  deliveryMode: string;
  playbackUrl: string;
  posterUrl: string;
  durationMs: number;
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
