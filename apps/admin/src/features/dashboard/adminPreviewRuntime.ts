import {
  normalizePreviewRuntime,
  type PreviewRuntimePayload,
  type PreviewRuntimeViewModel,
} from "../../../../shared/preview/previewRuntime";

export type AdminPreviewRuntimeViewModel = PreviewRuntimeViewModel;

export function normalizeAdminPreviewRuntime(
  payload: PreviewRuntimePayload | undefined,
  errorMessage: string,
): AdminPreviewRuntimeViewModel {
  return normalizePreviewRuntime(payload, errorMessage);
}
