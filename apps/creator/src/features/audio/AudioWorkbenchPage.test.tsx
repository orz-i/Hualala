import { render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AudioWorkbenchPage } from "./AudioWorkbenchPage";

describe("AudioWorkbenchPage", () => {
  const t = createTranslator("zh-CN");

  it("renders audio runtime playback, waveform references, and failed runtime details", () => {
    render(
      <AudioWorkbenchPage
        audioWorkbench={{
          timeline: {
            audioTimelineId: "timeline-project-1",
            projectId: "project-1",
            episodeId: "",
            status: "draft",
            renderWorkflowRunId: "workflow-audio-legacy",
            renderStatus: "queued",
            createdAt: "2026-03-25T09:00:00.000Z",
            updatedAt: "2026-03-25T09:05:00.000Z",
          },
          tracks: [
            {
              trackId: "track-dialogue",
              timelineId: "timeline-project-1",
              trackType: "dialogue",
              displayName: "对白",
              sequence: 1,
              muted: false,
              solo: false,
              volumePercent: 100,
              clips: [
                {
                  clipId: "clip-1",
                  trackId: "track-dialogue",
                  assetId: "asset-audio-1",
                  sourceRunId: "run-audio-1",
                  sequence: 1,
                  startMs: 0,
                  durationMs: 12000,
                  trimInMs: 0,
                  trimOutMs: 0,
                },
              ],
            },
          ],
          summary: {
            trackCount: 1,
            clipCount: 1,
            missingDurationClipCount: 0,
          },
        }}
        draftTracks={[
          {
            trackId: "track-dialogue",
            timelineId: "timeline-project-1",
            trackType: "dialogue",
            displayName: "对白",
            sequence: 1,
            muted: false,
            solo: false,
            volumePercent: 100,
            clips: [
              {
                clipId: "clip-1",
                trackId: "track-dialogue",
                assetId: "asset-audio-1",
                sourceRunId: "run-audio-1",
                sequence: 1,
                startMs: 0,
                durationMs: 12000,
                trimInMs: 0,
                trimOutMs: 0,
              },
            ],
          },
        ]}
        audioAssetPool={[]}
        audioAssetPoolErrorMessage=""
        audioRuntime={{
          audioRuntimeId: "audio-runtime-project-1",
          projectId: "project-1",
          episodeId: "",
          audioTimelineId: "timeline-project-1",
          status: "failed",
          renderWorkflowRunId: "workflow-audio-1",
          renderStatus: "failed",
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
          lastErrorCode: "audio_render_failed",
          lastErrorMessage: "worker callback timeout",
        }}
        runtimeErrorMessage=""
        requestRenderDisabledReason=""
        requestRenderPending={false}
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onAddClip={vi.fn()}
        onRemoveClip={vi.fn()}
        onMoveClip={vi.fn()}
        onTrackVolumeChange={vi.fn()}
        onTrackMutedChange={vi.fn()}
        onTrackSoloChange={vi.fn()}
        onClipFieldChange={vi.fn()}
        onSaveTimeline={vi.fn()}
        onRequestAudioRender={vi.fn()}
        onOpenAssetProvenance={vi.fn()}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    expect(screen.getByText("音频渲染态势")).toBeInTheDocument();
    expect(screen.getByText("渲染状态：failed")).toBeInTheDocument();
    expect(screen.getByText("交付模式：file")).toBeInTheDocument();
    expect(screen.getByTestId("audio-runtime-player")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开混音输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/audio/project-1/mix-download.mp3",
    );
    expect(screen.getByRole("link", { name: "打开 waveform" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/audio/project-1/waveform-1.json",
    );
    expect(screen.getByText("最后错误码：audio_render_failed")).toBeInTheDocument();
    expect(screen.getByText("最后错误信息：worker callback timeout")).toBeInTheDocument();
  });
});
