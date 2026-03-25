export const AUDIO_WAVEFORM_DOCUMENT_VERSION = "audio_waveform_v1";

export type AudioWaveformDocumentPayload = {
  version?: unknown;
  duration_ms?: unknown;
  peaks?: unknown;
};

export type AudioWaveformDocumentV1 = {
  version: typeof AUDIO_WAVEFORM_DOCUMENT_VERSION;
  durationMs: number;
  peaks: number[];
};

function fail(errorMessage: string, detail: string): never {
  throw new Error(`${errorMessage}: ${detail}`);
}

export function parseAudioWaveformDocument(
  payload: unknown,
  errorMessage: string,
): AudioWaveformDocumentV1 {
  if (!payload || typeof payload !== "object") {
    fail(errorMessage, "payload must be an object");
  }

  const document = payload as AudioWaveformDocumentPayload;
  if (document.version !== AUDIO_WAVEFORM_DOCUMENT_VERSION) {
    fail(errorMessage, "version must be audio_waveform_v1");
  }

  if (!Number.isInteger(document.duration_ms) || document.duration_ms <= 0) {
    fail(errorMessage, "duration_ms must be a positive integer");
  }

  if (!Array.isArray(document.peaks) || document.peaks.length === 0) {
    fail(errorMessage, "peaks must be a non-empty array");
  }

  const peaks = document.peaks.map((peak, index) => {
    if (typeof peak !== "number" || !Number.isFinite(peak) || peak < 0 || peak > 1) {
      fail(errorMessage, `peaks[${index}] must be a finite number between 0 and 1`);
    }
    return peak;
  });

  return {
    version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
    durationMs: document.duration_ms,
    peaks,
  };
}
