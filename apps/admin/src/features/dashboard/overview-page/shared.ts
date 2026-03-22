import type { CSSProperties } from "react";

export type FeedbackMessage = {
  tone: "pending" | "success" | "error";
  message: string;
};

export const panelStyle: CSSProperties = {
  borderRadius: "22px",
  padding: "22px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(232,244,247,0.9))",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.08)",
};

export const metricStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "0.95rem",
};

export const actionButtonBaseStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "8px 14px",
};

export const actionButtonToneStyles = {
  retry: {
    background: "#b45309",
    color: "#fffbeb",
    cursor: "pointer",
  } satisfies CSSProperties,
  cancel: {
    background: "#991b1b",
    color: "#fef2f2",
    cursor: "pointer",
  } satisfies CSSProperties,
  pending: {
    background: "#94a3b8",
    cursor: "not-allowed",
  } satisfies CSSProperties,
  close: {
    background: "#cbd5e1",
    color: "#0f172a",
    cursor: "pointer",
  } satisfies CSSProperties,
  confirm: {
    background: "#0369a1",
    color: "#f0f9ff",
    cursor: "pointer",
  } satisfies CSSProperties,
  primary: {
    background: "#166534",
    color: "#f0fdf4",
    cursor: "pointer",
  } satisfies CSSProperties,
};

export function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

export function formatDateTime(value: string) {
  if (!value) {
    return "pending";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${sizeBytes} B`;
}

export function getFeedbackPalette(feedback?: FeedbackMessage): CSSProperties {
  if (feedback?.tone === "error") {
    return { color: "#991b1b" };
  }
  if (feedback?.tone === "pending") {
    return { color: "#92400e" };
  }
  return { color: "#115e59" };
}
