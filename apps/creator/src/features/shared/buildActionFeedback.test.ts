import {
  buildImportFeedback,
  buildShotFeedback,
  createFeedbackSections,
} from "./buildActionFeedback";
import { createTranslator } from "../../i18n";

describe("buildActionFeedback", () => {
  it("omits empty sections when creating feedback sections", () => {
    expect(
      createFeedbackSections([
        { label: "空字符串", items: "" },
        { label: "空数组", items: [] },
        { label: "有效值", items: "confirmed" },
      ]),
    ).toEqual([{ label: "有效值", items: "confirmed" }]);
  });

  it("builds shot feedback with gate checks and review summary in zh-CN", () => {
    expect(
      buildShotFeedback({
        t: createTranslator("zh-CN"),
        tone: "success",
        messageKey: "feedback.success.runGateChecks",
        passedChecks: ["asset_selected"],
        failedChecks: ["copyright_missing"],
        latestConclusion: "approved",
        latestEvaluationStatus: "passed",
      }),
    ).toEqual({
      tone: "success",
      message: "Gate 检查已完成",
      sections: [
        { label: "通过检查", items: ["asset_selected"] },
        { label: "未通过检查", items: ["copyright_missing"] },
        { label: "最新评审结论", items: "approved" },
        { label: "最近评估", items: "passed" },
      ],
    });
  });

  it("builds import feedback without redundant primary asset section in en-US", () => {
    expect(
      buildImportFeedback({
        t: createTranslator("en-US"),
        tone: "success",
        messageKey: "feedback.success.confirmMatches",
        latestImportBatchStatus: "confirmed",
        latestShotExecutionStatus: "candidate_ready",
        latestPrimaryAssetId: "",
      }),
    ).toEqual({
      tone: "success",
      message: "Matches confirmed",
      sections: [
        { label: "Current batch status", items: "confirmed" },
        { label: "Current execution status", items: "candidate_ready" },
      ],
    });
  });
});
