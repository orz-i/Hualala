import { createProjectClient } from "@hualala/sdk";
import { loadAudioRuntime } from "./loadAudioRuntime";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadAudioRuntime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes audio runtime data for creator", async () => {
    const getAudioRuntimeMock = vi.fn().mockResolvedValue({
      runtime: {
        audioRuntimeId: "audio-runtime-project-1",
        projectId: "project-1",
        episodeId: "",
        audioTimelineId: "timeline-project-1",
        status: "ready",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "completed",
        mixAssetId: "asset-mix-1",
        createdAt: "2026-03-25T09:00:00.000Z",
        updatedAt: "2026-03-25T09:05:00.000Z",
        mixOutput: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/audio/project-1/mix.mp3",
          downloadUrl: "https://cdn.example.com/audio/project-1/mix-download.mp3",
          mimeType: "audio/mpeg",
          fileName: "mix-project-1.mp3",
          sizeBytes: 4096,
          durationMs: 18000,
        },
        waveforms: [
          {
            assetId: "asset-audio-1",
            variantId: "variant-audio-1",
            waveformUrl: "https://cdn.example.com/audio/project-1/waveform-1.json",
            mimeType: "application/json",
            durationMs: 12000,
          },
        ],
        lastErrorCode: "",
        lastErrorMessage: "",
      },
    });
    createProjectClientMock.mockReturnValue({
      getAudioRuntime: getAudioRuntimeMock,
    } as never);

    const result = await loadAudioRuntime({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createProjectClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: "org-1",
          userId: "user-1",
        },
      }),
    );
    expect(getAudioRuntimeMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        audioRuntimeId: "audio-runtime-project-1",
        renderStatus: "completed",
        mixAssetId: "asset-mix-1",
        mixOutput: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/audio/project-1/mix.mp3",
          downloadUrl: "https://cdn.example.com/audio/project-1/mix-download.mp3",
          mimeType: "audio/mpeg",
          fileName: "mix-project-1.mp3",
          sizeBytes: 4096,
          durationMs: 18000,
        },
        waveforms: [
          {
            assetId: "asset-audio-1",
            variantId: "variant-audio-1",
            waveformUrl: "https://cdn.example.com/audio/project-1/waveform-1.json",
            mimeType: "application/json",
            durationMs: 12000,
          },
        ],
      }),
    );
  });

  it("throws when the audio runtime payload is incomplete", async () => {
    createProjectClientMock.mockReturnValue({
      getAudioRuntime: vi.fn().mockResolvedValue({
        runtime: {
          audioRuntimeId: "",
          projectId: "",
        },
      }),
    } as never);

    await expect(
      loadAudioRuntime({
        projectId: "project-1",
      }),
    ).rejects.toThrow("creator: audio runtime payload is incomplete");
  });
});
