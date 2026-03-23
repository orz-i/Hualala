export type AdminPreviewAssemblyViewModel = {
  assemblyId: string;
  projectId: string;
  episodeId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPreviewItemViewModel = {
  itemId: string;
  assemblyId: string;
  shotId: string;
  primaryAssetId: string;
  sourceRunId: string;
  sequence: number;
};

export type AdminPreviewWorkbenchViewModel = {
  assembly: AdminPreviewAssemblyViewModel;
  items: AdminPreviewItemViewModel[];
  summary: {
    itemCount: number;
    missingPrimaryAssetCount: number;
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
};

function normalizeSequence(value: number | undefined, fallback: number) {
  return typeof value === "number" && value > 0 ? value : fallback;
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
    },
  };
}
