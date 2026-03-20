import { render, screen } from "@testing-library/react";
import { ActionFeedback } from "./ActionFeedback";

describe("ActionFeedback", () => {
  it("renders success feedback with string and list sections", () => {
    render(
      <ActionFeedback
        feedback={{
          tone: "success",
          message: "提交评审已完成",
          sections: [
            { label: "通过检查", items: ["asset_selected", "review_ready"] },
            { label: "最新评审结论", items: "approved" },
          ],
        }}
      />,
    );

    expect(screen.getByText("提交评审已完成")).toBeInTheDocument();
    expect(screen.getByText("通过检查")).toBeInTheDocument();
    expect(screen.getByText("asset_selected")).toBeInTheDocument();
    expect(screen.getByText("review_ready")).toBeInTheDocument();
    expect(screen.getByText("最新评审结论：approved")).toHaveStyle({
      color: "#115e59",
    });
  });

  it("renders error feedback and skips empty sections", () => {
    render(
      <ActionFeedback
        feedback={{
          tone: "error",
          message: "匹配确认失败：network down",
          sections: [
            { label: "空列表", items: [] },
            { label: "空串", items: "" },
          ],
        }}
      />,
    );

    expect(screen.getByText("匹配确认失败：network down")).toHaveStyle({
      color: "#991b1b",
    });
    expect(screen.queryByText("空列表")).not.toBeInTheDocument();
    expect(screen.queryByText("空串")).not.toBeInTheDocument();
  });
});
