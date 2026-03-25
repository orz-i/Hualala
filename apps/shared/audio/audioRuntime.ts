export type AudioMixOutputViewModel = {
  deliveryMode: string;
  playbackUrl: string;
  downloadUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  durationMs: number;
};

export type AudioWaveformReferenceViewModel = {
  assetId: string;
  variantId: string;
  waveformUrl: string;
  mimeType: string;
  durationMs: number;
};

export type AudioRuntimeViewModel = {
  audioRuntimeId: string;
  projectId: string;
  episodeId: string;
  audioTimelineId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  mixAssetId: string;
  mixOutput: AudioMixOutputViewModel | null;
  waveforms: AudioWaveformReferenceViewModel[];
  lastErrorCode: string;
  lastErrorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type AudioRuntimePayload = {
  audioRuntimeId?: string;
  projectId?: string;
  episodeId?: string;
  audioTimelineId?: string;
  status?: string;
  renderWorkflowRunId?: string;
  renderStatus?: string;
  mixAssetId?: string;
  mixOutput?: {
    deliveryMode?: string;
    playbackUrl?: string;
    downloadUrl?: string;
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
    durationMs?: number;
  } | null;
  waveforms?: Array<{
    assetId?: string;
    variantId?: string;
    waveformUrl?: string;
    mimeType?: string;
    durationMs?: number;
  }>;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeMixOutput(
  mixOutput: AudioRuntimePayload["mixOutput"],
): AudioMixOutputViewModel | null {
  if (!mixOutput) {
    return null;
  }

  return {
    deliveryMode: mixOutput.deliveryMode ?? "",
    playbackUrl: mixOutput.playbackUrl ?? "",
    downloadUrl: mixOutput.downloadUrl ?? "",
    mimeType: mixOutput.mimeType ?? "",
    fileName: mixOutput.fileName ?? "",
    sizeBytes: mixOutput.sizeBytes ?? 0,
    durationMs: mixOutput.durationMs ?? 0,
  };
}

function normalizeWaveforms(
  waveforms: AudioRuntimePayload["waveforms"],
): AudioWaveformReferenceViewModel[] {
  return [...(waveforms ?? [])].map((waveform) => ({
    assetId: waveform.assetId ?? "",
    variantId: waveform.variantId ?? "",
    waveformUrl: waveform.waveformUrl ?? "",
    mimeType: waveform.mimeType ?? "",
    durationMs: waveform.durationMs ?? 0,
  }));
}

export function normalizeAudioRuntime(
  payload: AudioRuntimePayload | undefined,
  errorMessage: string,
): AudioRuntimeViewModel {
  if (!payload?.audioRuntimeId || !payload.projectId) {
    throw new Error(errorMessage);
  }

  return {
    audioRuntimeId: payload.audioRuntimeId,
    projectId: payload.projectId,
    episodeId: payload.episodeId ?? "",
    audioTimelineId: payload.audioTimelineId ?? "",
    status: payload.status ?? "",
    renderWorkflowRunId: payload.renderWorkflowRunId ?? "",
    renderStatus: payload.renderStatus ?? "",
    mixAssetId: payload.mixAssetId ?? "",
    mixOutput: normalizeMixOutput(payload.mixOutput),
    waveforms: normalizeWaveforms(payload.waveforms),
    lastErrorCode: payload.lastErrorCode ?? "",
    lastErrorMessage: payload.lastErrorMessage ?? "",
    createdAt: payload.createdAt ?? "",
    updatedAt: payload.updatedAt ?? "",
  };
}
