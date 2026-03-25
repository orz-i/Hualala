import type { CSSProperties } from "react";

export function formatRuntimeField(value: string, fallback: string) {
  return value || fallback;
}

export function formatRuntimeNumber(
  value: number,
  suffix: string,
  fallback: string,
  options?: { allowZero?: boolean },
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return fallback;
  }
  if (value === 0 && !options?.allowZero) {
    return fallback;
  }
  return `${value}${suffix}`;
}

export function buildRuntimeOutputLinkStyle(style?: CSSProperties): CSSProperties {
  return {
    ...style,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
