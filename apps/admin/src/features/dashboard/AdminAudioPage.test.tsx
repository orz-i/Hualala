import { render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminAudioPage } from "./AdminAudioPage";

describe("AdminAudioPage", () => {
  const t = createTranslator("zh-CN");

  it("renders runtime audit details without embedding an audio player", () => {
    render(
      <AdminAudioPage
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
          tracks: [],
          summary: {
            trackCount: 0,
            clipCount: 0,
            missingAssetCount: 0,
            invalidTimingClipCount: 0,
            tracksByType: [],
          },
        }}
        audioRuntime={{
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
          lastErrorCode: "",
          lastErrorMessage: "",
        }}
        runtimeErrorMessage=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onOpenAssetProvenance={vi.fn()}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    expect(screen.getByText("音频运行态势")).toBeInTheDocument();
    expect(screen.getByText("渲染状态：completed")).toBeInTheDocument();
    expect(screen.getByText("交付模式：file")).toBeInTheDocument();
    expect(screen.getByText("文件名：mix-project-1.mp3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开混音输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/audio/project-1/mix-download.mp3",
    );
    expect(screen.getByRole("link", { name: "打开 waveform" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/audio/project-1/waveform-1.json",
    );
    expect(screen.queryByTestId("audio-runtime-player")).not.toBeInTheDocument();
  });
});
