import {
  buildImportFeedback,
  buildShotFeedback,
  createFeedbackSections,
} from "./buildActionFeedback";

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

  it("builds shot feedback with gate checks and review summary", () => {
    expect(
      buildShotFeedback({
        tone: "success",
        message: "Gate 检查已完成",
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

  it("builds import feedback without redundant primary asset section", () => {
    expect(
      buildImportFeedback({
        tone: "success",
        message: "匹配确认已完成",
        latestImportBatchStatus: "confirmed",
        latestShotExecutionStatus: "candidate_ready",
        latestPrimaryAssetId: "",
      }),
    ).toEqual({
      tone: "success",
      message: "匹配确认已完成",
      sections: [
        { label: "当前批次状态", items: "confirmed" },
        { label: "当前执行状态", items: "candidate_ready" },
      ],
    });
  });
});
