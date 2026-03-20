import type { ActionFeedbackModel, ActionFeedbackSection } from "./ActionFeedback";

type FeedbackSectionInput = {
  label: string;
  items?: string[] | string | undefined;
};

type BuildShotFeedbackOptions = {
  tone: ActionFeedbackModel["tone"];
  message: string;
  passedChecks?: string[];
  failedChecks?: string[];
  latestConclusion?: string;
  latestEvaluationStatus?: string;
};

type BuildImportFeedbackOptions = {
  tone: ActionFeedbackModel["tone"];
  message: string;
  latestImportBatchStatus?: string;
  latestShotExecutionStatus?: string;
  latestPrimaryAssetId?: string;
};

export function createFeedbackSections(
  entries: FeedbackSectionInput[],
): ActionFeedbackSection[] {
  return entries.flatMap((entry): ActionFeedbackSection[] => {
    if (entry.items === undefined) {
      return [];
    }

    if (Array.isArray(entry.items)) {
      return entry.items.length > 0 ? [{ label: entry.label, items: entry.items }] : [];
    }

    return entry.items.trim() !== ""
      ? [{ label: entry.label, items: entry.items }]
      : [];
  });
}

export function buildShotFeedback({
  tone,
  message,
  passedChecks,
  failedChecks,
  latestConclusion,
  latestEvaluationStatus,
}: BuildShotFeedbackOptions): ActionFeedbackModel {
  return {
    tone,
    message,
    sections: createFeedbackSections([
      { label: "通过检查", items: passedChecks },
      { label: "未通过检查", items: failedChecks },
      { label: "最新评审结论", items: latestConclusion },
      { label: "最近评估", items: latestEvaluationStatus },
    ]),
  };
}

export function buildImportFeedback({
  tone,
  message,
  latestImportBatchStatus,
  latestShotExecutionStatus,
  latestPrimaryAssetId,
}: BuildImportFeedbackOptions): ActionFeedbackModel {
  return {
    tone,
    message,
    sections: createFeedbackSections([
      { label: "当前批次状态", items: latestImportBatchStatus },
      { label: "当前执行状态", items: latestShotExecutionStatus },
      { label: "当前主素材", items: latestPrimaryAssetId || undefined },
    ]),
  };
}
