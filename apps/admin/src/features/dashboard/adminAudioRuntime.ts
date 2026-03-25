import {
  normalizeAudioRuntime,
  type AudioRuntimePayload,
  type AudioRuntimeViewModel,
} from "../../../../shared/audio/audioRuntime";

export type AdminAudioRuntimeViewModel = AudioRuntimeViewModel;

export function normalizeAdminAudioRuntime(
  payload: AudioRuntimePayload | undefined,
  errorMessage: string,
): AdminAudioRuntimeViewModel {
  return normalizeAudioRuntime(payload, errorMessage);
}
