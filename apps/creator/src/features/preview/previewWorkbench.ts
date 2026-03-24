export type PreviewAssemblyViewModel = {
  assemblyId: string;
  projectId: string;
  episodeId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PreviewShotSummaryViewModel = {
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

export type PreviewAssetSummaryViewModel = {
  assetId: string;
  mediaType: string;
  rightsStatus: string;
  aiAnnotated: boolean;
};

export type PreviewRunSummaryViewModel = {
  runId: string;
  status: string;
  triggerType: string;
};

export type PreviewItemViewModel = {
  itemId: string;
  assemblyId: string;
  shotId: string;
  primaryAssetId: string;
  sourceRunId: string;
  sequence: number;
  shotSummary: PreviewShotSummaryViewModel | null;
  primaryAssetSummary: PreviewAssetSummaryViewModel | null;
  sourceRunSummary: PreviewRunSummaryViewModel | null;
};

export type PreviewShotOptionViewModel = {
  shotId: string;
  label: string;
  shotExecutionId: string;
  shotExecutionStatus: string;
  shotSummary: PreviewShotSummaryViewModel;
  currentPrimaryAssetSummary: PreviewAssetSummaryViewModel | null;
  latestRunSummary: PreviewRunSummaryViewModel | null;
};

export type PreviewWorkbenchViewModel = {
  assembly: PreviewAssemblyViewModel;
  items: PreviewItemViewModel[];
};

function buildOrderedDraftItems(items: PreviewItemViewModel[]) {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }));
}

function resolveHydratedAssetSummary({
  item,
  localizedItem,
  shotOption,
}: {
  item: PreviewItemViewModel;
  localizedItem: PreviewItemViewModel | null;
  shotOption: PreviewShotOptionViewModel | null;
}) {
  if (!item.primaryAssetId) {
    return null;
  }
  if (localizedItem?.primaryAssetSummary?.assetId === item.primaryAssetId) {
    return localizedItem.primaryAssetSummary;
  }
  if (shotOption?.currentPrimaryAssetSummary?.assetId === item.primaryAssetId) {
    return shotOption.currentPrimaryAssetSummary;
  }
  return item.primaryAssetSummary;
}

function resolveHydratedRunSummary({
  item,
  localizedItem,
  shotOption,
}: {
  item: PreviewItemViewModel;
  localizedItem: PreviewItemViewModel | null;
  shotOption: PreviewShotOptionViewModel | null;
}) {
  if (!item.sourceRunId) {
    return null;
  }
  if (localizedItem?.sourceRunSummary?.runId === item.sourceRunId) {
    return localizedItem.sourceRunSummary;
  }
  if (shotOption?.latestRunSummary?.runId === item.sourceRunId) {
    return shotOption.latestRunSummary;
  }
  return item.sourceRunSummary;
}

export function hydratePreviewDraftItemsFromLocale({
  draftItems,
  localizedItems,
  shotOptions,
}: {
  draftItems: PreviewItemViewModel[];
  localizedItems: PreviewItemViewModel[];
  shotOptions: PreviewShotOptionViewModel[];
}) {
  const localizedItemByItemId = new Map(
    localizedItems
      .filter((item) => item.itemId && !item.itemId.startsWith("draft-"))
      .map((item) => [item.itemId, item] as const),
  );
  const firstLocalizedItemByShotId = new Map<string, PreviewItemViewModel>();
  for (const localizedItem of localizedItems) {
    if (!firstLocalizedItemByShotId.has(localizedItem.shotId)) {
      firstLocalizedItemByShotId.set(localizedItem.shotId, localizedItem);
    }
  }
  const shotOptionByShotId = new Map(shotOptions.map((option) => [option.shotId, option] as const));

  return buildOrderedDraftItems(
    draftItems.map((item) => {
      const localizedItemFromItemId = localizedItemByItemId.get(item.itemId) ?? null;
      const localizedItemFromShotId = firstLocalizedItemByShotId.get(item.shotId) ?? null;
      // locale 切换后的 hydration 先尽量保留“同 item + 同 shot”的精确命中；
      // 如果保存后服务端重编了 itemId，则退回到按 shotId 重刷水合；
      // 只有在没有更好命中的情况下，才保留按旧 itemId 找到的摘要。
      const localizedItem =
        localizedItemFromItemId?.shotId === item.shotId
          ? localizedItemFromItemId
          : localizedItemFromShotId ?? localizedItemFromItemId;
      const shotOption = shotOptionByShotId.get(item.shotId) ?? null;
      return {
        ...item,
        shotSummary: localizedItem?.shotSummary ?? shotOption?.shotSummary ?? item.shotSummary,
        primaryAssetSummary: resolveHydratedAssetSummary({
          item,
          localizedItem,
          shotOption,
        }),
        sourceRunSummary: resolveHydratedRunSummary({
          item,
          localizedItem,
          shotOption,
        }),
      };
    }),
  );
}

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
): PreviewShotSummaryViewModel | null {
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
): PreviewAssetSummaryViewModel | null {
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
): PreviewRunSummaryViewModel | null {
  if (!payload?.runId) {
    return null;
  }

  return {
    runId: payload.runId,
    status: payload.status ?? "",
    triggerType: payload.triggerType ?? "",
  };
}

export function normalizeRequiredPreviewShotSummary(
  payload: PreviewShotSummaryPayload | undefined,
  errorMessage: string,
): PreviewShotSummaryViewModel {
  const normalized = normalizePreviewShotSummary(payload);
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}

export function buildPreviewShotOptionLabel(summary: PreviewShotSummaryViewModel) {
  const sceneSegment = summary.sceneCode || summary.sceneId || "scene";
  const shotSegment = summary.shotCode || summary.shotId;
  return `${sceneSegment} / ${shotSegment}`;
}

export function normalizePreviewWorkbench(
  assembly: PreviewAssemblyPayload | undefined,
  errorMessage: string,
): PreviewWorkbenchViewModel {
  if (!assembly?.assemblyId || !assembly.projectId) {
    throw new Error(errorMessage);
  }

  const normalizedAssembly: PreviewAssemblyViewModel = {
    assemblyId: assembly.assemblyId,
    projectId: assembly.projectId,
    episodeId: assembly.episodeId ?? "",
    status: assembly.status ?? "draft",
    createdAt: assembly.createdAt ?? "",
    updatedAt: assembly.updatedAt ?? "",
  };

  const normalizedItems = [...(assembly.items ?? [])]
    .sort((left, right) => {
      const leftSequence = normalizeSequence(left.sequence, Number.MAX_SAFE_INTEGER);
      const rightSequence = normalizeSequence(right.sequence, Number.MAX_SAFE_INTEGER);
      return leftSequence - rightSequence;
    })
    .map((item, index) => ({
      itemId: item.itemId ?? `item-${index + 1}`,
      assemblyId: item.assemblyId ?? normalizedAssembly.assemblyId,
      shotId: item.shotId ?? "",
      primaryAssetId: item.primaryAssetId ?? "",
      sourceRunId: item.sourceRunId ?? "",
      sequence: index + 1,
      shotSummary: normalizePreviewShotSummary(item.shot),
      primaryAssetSummary: normalizePreviewAssetSummary(item.primaryAsset),
      sourceRunSummary: normalizePreviewRunSummary(item.sourceRun),
    }));

  return {
    assembly: normalizedAssembly,
    items: normalizedItems,
  };
}
