import type { ActionFeedbackModel, ActionFeedbackSection } from "./ActionFeedback";
import type { CreatorMessageKey, CreatorTranslator } from "../../i18n";

type FeedbackSectionInput = {
  label: string;
  items?: string[] | string | undefined;
};

type BuildShotFeedbackOptions = {
  t: CreatorTranslator;
  tone: ActionFeedbackModel["tone"];
  messageKey: CreatorMessageKey;
  passedChecks?: string[];
  failedChecks?: string[];
  latestConclusion?: string;
  latestEvaluationStatus?: string;
};

type BuildImportFeedbackOptions = {
  t: CreatorTranslator;
  tone: ActionFeedbackModel["tone"];
  messageKey: CreatorMessageKey;
  latestImportBatchStatus?: string;
  latestUploadSessionStatus?: string;
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
  t,
  tone,
  messageKey,
  passedChecks,
  failedChecks,
  latestConclusion,
  latestEvaluationStatus,
}: BuildShotFeedbackOptions): ActionFeedbackModel {
  return {
    tone,
    message: t(messageKey),
    sections: createFeedbackSections([
      { label: t("feedback.section.passedChecks"), items: passedChecks },
      { label: t("feedback.section.failedChecks"), items: failedChecks },
      { label: t("feedback.section.latestConclusion"), items: latestConclusion },
      { label: t("feedback.section.latestEvaluation"), items: latestEvaluationStatus },
    ]),
  };
}

export function buildImportFeedback({
  t,
  tone,
  messageKey,
  latestImportBatchStatus,
  latestUploadSessionStatus,
  latestShotExecutionStatus,
  latestPrimaryAssetId,
}: BuildImportFeedbackOptions): ActionFeedbackModel {
  return {
    tone,
    message: t(messageKey),
    sections: createFeedbackSections([
      { label: t("feedback.section.importBatchStatus"), items: latestImportBatchStatus },
      { label: t("feedback.section.uploadStatus"), items: latestUploadSessionStatus },
      { label: t("feedback.section.executionStatus"), items: latestShotExecutionStatus },
      { label: t("feedback.section.primaryAsset"), items: latestPrimaryAssetId || undefined },
    ]),
  };
}
