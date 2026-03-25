import { createProjectClient } from "@hualala/sdk";
import { loadAdminAudioRuntime } from "./loadAdminAudioRuntime";

vi.mock("@hualala/sdk", () => ({
  createProjectClient: vi.fn(),
}));

const createProjectClientMock = vi.mocked(createProjectClient);

describe("loadAdminAudioRuntime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads and normalizes audio runtime data for admin", async () => {
    const getAudioRuntimeMock = vi.fn().mockResolvedValue({
      runtime: {
        audioRuntimeId: "audio-runtime-project-1",
        projectId: "project-1",
        episodeId: "",
        audioTimelineId: "timeline-project-1",
        status: "failed",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "failed",
        mixAssetId: "",
        createdAt: "2026-03-25T09:00:00.000Z",
        updatedAt: "2026-03-25T09:05:00.000Z",
        mixOutput: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/audio/project-1/mix.mp3",
          downloadUrl: "https://cdn.example.com/audio/project-1/mix-download.mp3",
          mimeType: "audio/mpeg",
          fileName: "mix-project-1.mp3",
          sizeBytes: 8192,
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
        lastErrorCode: "audio_render_failed",
        lastErrorMessage: "worker callback timeout",
      },
    });
    createProjectClientMock.mockReturnValue({
      getAudioRuntime: getAudioRuntimeMock,
    } as never);

    const result = await loadAdminAudioRuntime({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });

    expect(getAudioRuntimeMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        audioRuntimeId: "audio-runtime-project-1",
        renderStatus: "failed",
        mixOutput: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/audio/project-1/mix.mp3",
          downloadUrl: "https://cdn.example.com/audio/project-1/mix-download.mp3",
          mimeType: "audio/mpeg",
          fileName: "mix-project-1.mp3",
          sizeBytes: 8192,
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
        lastErrorCode: "audio_render_failed",
        lastErrorMessage: "worker callback timeout",
      }),
    );
  });

  it("throws when the admin audio runtime payload is incomplete", async () => {
    createProjectClientMock.mockReturnValue({
      getAudioRuntime: vi.fn().mockResolvedValue({
        runtime: {
          audioRuntimeId: "",
          projectId: "",
        },
      }),
    } as never);

    await expect(
      loadAdminAudioRuntime({
        projectId: "project-1",
      }),
    ).rejects.toThrow("admin: audio runtime payload is incomplete");
  });
});
