import type { PreviewTransitionViewModel } from "./previewRuntime";

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

export function formatTimelineShot(
  shotCode: string,
  shotTitle: string,
  fallback: string,
) {
  const code = shotCode || fallback;
  const title = shotTitle || fallback;
  return `${code} / ${title}`;
}

export function formatTimelineTransition(
  transition: PreviewTransitionViewModel | null,
  fallback: string,
) {
  if (!transition) {
    return "";
  }

  return `${transition.transitionType || fallback} · ${formatRuntimeNumber(
    transition.durationMs,
    "ms",
    fallback,
  )}`;
}
