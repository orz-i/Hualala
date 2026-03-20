import type { CSSProperties } from "react";

export type ActionFeedbackSection = {
  label: string;
  items: string[] | string;
};

export type ActionFeedbackModel = {
  tone: "success" | "error" | "pending";
  message: string;
  sections?: ActionFeedbackSection[];
};

type ActionFeedbackProps = {
  feedback: ActionFeedbackModel;
};

const baseStyle: CSSProperties = {
  margin: "16px 0 0",
  padding: "10px 14px",
  borderRadius: "14px",
  fontSize: "0.95rem",
};

export function ActionFeedback({ feedback }: ActionFeedbackProps) {
  const palette =
    feedback.tone === "error"
      ? {
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(220, 38, 38, 0.24)",
          color: "#991b1b",
        }
      : feedback.tone === "pending"
        ? {
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(180, 83, 9, 0.22)",
            color: "#92400e",
          }
        : {
            background: "rgba(15, 118, 110, 0.12)",
            border: "1px solid rgba(13, 148, 136, 0.2)",
            color: "#115e59",
          };

  const sections = (feedback.sections ?? []).filter((section) =>
    Array.isArray(section.items) ? section.items.length > 0 : section.items.trim() !== "",
  );

  return (
    <div style={{ ...baseStyle, ...palette }}>
      <p style={{ margin: 0 }}>{feedback.message}</p>
      {sections.map((section, index) =>
        Array.isArray(section.items) ? (
          <div key={`${section.label}-${index}`} style={{ marginTop: "10px" }}>
            <strong>{section.label}</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p
            key={`${section.label}-${index}`}
            style={{ margin: index === 0 ? "10px 0 0" : "6px 0 0" }}
          >
            {section.label}：{section.items}
          </p>
        ),
      )}
    </div>
  );
}
