import { AUDIO_WAVEFORM_DOCUMENT_VERSION, parseAudioWaveformDocument } from "../../../../shared/audio/audioWaveformDocument";

describe("parseAudioWaveformDocument", () => {
  it("parses a valid v1 waveform document", () => {
    expect(
      parseAudioWaveformDocument(
        {
          version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
          duration_ms: 12000,
          peaks: [0, 0.2, 0.8, 1],
        },
        "creator: waveform document is invalid",
      ),
    ).toEqual({
      version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
      durationMs: 12000,
      peaks: [0, 0.2, 0.8, 1],
    });
  });

  it("fails closed when version is invalid", () => {
    expect(() =>
      parseAudioWaveformDocument(
        {
          version: "audio_waveform_v0",
          duration_ms: 12000,
          peaks: [0.1, 0.4],
        },
        "creator: waveform document is invalid",
      ),
    ).toThrow("creator: waveform document is invalid");
  });

  it("fails closed when duration is not positive", () => {
    expect(() =>
      parseAudioWaveformDocument(
        {
          version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
          duration_ms: 0,
          peaks: [0.1, 0.4],
        },
        "creator: waveform document is invalid",
      ),
    ).toThrow("creator: waveform document is invalid");
  });

  it("fails closed when peaks are empty", () => {
    expect(() =>
      parseAudioWaveformDocument(
        {
          version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
          duration_ms: 12000,
          peaks: [],
        },
        "creator: waveform document is invalid",
      ),
    ).toThrow("creator: waveform document is invalid");
  });

  it("fails closed when peaks contain out-of-range or non-finite values", () => {
    for (const peaks of [
      [-0.1, 0.4],
      [0.1, 1.1],
      [0.1, Number.NaN],
    ]) {
      expect(() =>
        parseAudioWaveformDocument(
          {
            version: AUDIO_WAVEFORM_DOCUMENT_VERSION,
            duration_ms: 12000,
            peaks,
          },
          "creator: waveform document is invalid",
        ),
      ).toThrow("creator: waveform document is invalid");
    }
  });
});
