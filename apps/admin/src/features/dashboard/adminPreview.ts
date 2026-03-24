export type AdminPreviewAssemblyViewModel = {
  assemblyId: string;
  projectId: string;
  episodeId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPreviewShotSummaryViewModel = {
  projectId: string;
  projectTitle: string;
  episodeId: string;
  episodeTitle: string;
  sceneId: string;
  sceneCode: string;
  sceneTitle: string;
  shotId: string;
  shotCode: string;
  shotTitle: string;
};

export type AdminPreviewAssetSummaryViewModel = {
  assetId: string;
  mediaType: string;
  rightsStatus: string;
  aiAnnotated: boolean;
};

export type AdminPreviewRunSummaryViewModel = {
  runId: string;
  status: string;
  triggerType: string;
};

export type AdminPreviewItemViewModel = {
  itemId: string;
  assemblyId: string;
  shotId: string;
  primaryAssetId: string;
  sourceRunId: string;
  sequence: number;
  shotSummary: AdminPreviewShotSummaryViewModel | null;
  primaryAssetSummary: AdminPreviewAssetSummaryViewModel | null;
  sourceRunSummary: AdminPreviewRunSummaryViewModel | null;
};

export type AdminPreviewWorkbenchViewModel = {
  assembly: AdminPreviewAssemblyViewModel;
  items: AdminPreviewItemViewModel[];
  summary: {
    itemCount: number;
    missingPrimaryAssetCount: number;
    missingSourceRunCount: number;
  };
};

type PreviewAssemblyPayload = {
  assemblyId?: string;
  projectId?: string;
  episodeId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PreviewItemPayload[];
};

type PreviewItemPayload = {
  itemId?: string;
  assemblyId?: string;
  shotId?: string;
  primaryAssetId?: string;
  sourceRunId?: string;
  sequence?: number;
  shot?: PreviewShotSummaryPayload;
  primaryAsset?: PreviewAssetSummaryPayload;
  sourceRun?: PreviewRunSummaryPayload;
};

type PreviewShotSummaryPayload = {
  projectId?: string;
  projectTitle?: string;
  episodeId?: string;
  episodeTitle?: string;
  sceneId?: string;
  sceneCode?: string;
  sceneTitle?: string;
  shotId?: string;
  shotCode?: string;
  shotTitle?: string;
};

type PreviewAssetSummaryPayload = {
  assetId?: string;
  mediaType?: string;
  rightsStatus?: string;
  aiAnnotated?: boolean;
};

type PreviewRunSummaryPayload = {
  runId?: string;
  status?: string;
  triggerType?: string;
};

function normalizeSequence(value: number | undefined, fallback: number) {
  return typeof value === "number" && value > 0 ? value : fallback;
}

function normalizePreviewShotSummary(
  payload: PreviewShotSummaryPayload | undefined,
): AdminPreviewShotSummaryViewModel | null {
  if (!payload?.shotId) {
    return null;
  }

  return {
    projectId: payload.projectId ?? "",
    projectTitle: payload.projectTitle ?? "",
    episodeId: payload.episodeId ?? "",
    episodeTitle: payload.episodeTitle ?? "",
    sceneId: payload.sceneId ?? "",
    sceneCode: payload.sceneCode ?? "",
    sceneTitle: payload.sceneTitle ?? "",
    shotId: payload.shotId,
    shotCode: payload.shotCode ?? "",
    shotTitle: payload.shotTitle ?? "",
  };
}

function normalizePreviewAssetSummary(
  payload: PreviewAssetSummaryPayload | undefined,
): AdminPreviewAssetSummaryViewModel | null {
  if (!payload?.assetId) {
    return null;
  }

  return {
    assetId: payload.assetId,
    mediaType: payload.mediaType ?? "",
    rightsStatus: payload.rightsStatus ?? "",
    aiAnnotated: payload.aiAnnotated ?? false,
  };
}

function normalizePreviewRunSummary(
  payload: PreviewRunSummaryPayload | undefined,
): AdminPreviewRunSummaryViewModel | null {
  if (!payload?.runId) {
    return null;
  }

  return {
    runId: payload.runId,
    status: payload.status ?? "",
    triggerType: payload.triggerType ?? "",
  };
}

export function normalizeAdminPreviewWorkbench(
  assembly: PreviewAssemblyPayload | undefined,
  errorMessage: string,
): AdminPreviewWorkbenchViewModel {
  if (!assembly?.assemblyId || !assembly.projectId) {
    throw new Error(errorMessage);
  }

  const normalizedItems = [...(assembly.items ?? [])]
    .sort((left, right) => {
      const leftSequence = normalizeSequence(left.sequence, Number.MAX_SAFE_INTEGER);
      const rightSequence = normalizeSequence(right.sequence, Number.MAX_SAFE_INTEGER);
      return leftSequence - rightSequence;
    })
    .map((item, index) => ({
      itemId: item.itemId ?? `item-${index + 1}`,
      assemblyId: item.assemblyId ?? assembly.assemblyId ?? "",
      shotId: item.shotId ?? "",
      primaryAssetId: item.primaryAssetId ?? "",
      sourceRunId: item.sourceRunId ?? "",
      sequence: index + 1,
      shotSummary: normalizePreviewShotSummary(item.shot),
      primaryAssetSummary: normalizePreviewAssetSummary(item.primaryAsset),
      sourceRunSummary: normalizePreviewRunSummary(item.sourceRun),
    }));

  return {
    assembly: {
      assemblyId: assembly.assemblyId,
      projectId: assembly.projectId,
      episodeId: assembly.episodeId ?? "",
      status: assembly.status ?? "draft",
      createdAt: assembly.createdAt ?? "",
      updatedAt: assembly.updatedAt ?? "",
    },
    items: normalizedItems,
    summary: {
      itemCount: normalizedItems.length,
      missingPrimaryAssetCount: normalizedItems.filter((item) => !item.primaryAssetId).length,
      missingSourceRunCount: normalizedItems.filter((item) => !item.sourceRunSummary).length,
    },
  };
}
