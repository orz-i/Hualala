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
};

type PreviewRuntimePayload = {
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
};

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
  };
}
