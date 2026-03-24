import type { AudioTimelineState } from "./types.ts";

type UpsertAudioTimelineBody = {
  projectId?: string;
  status?: string;
  renderWorkflowRunId?: string;
  renderStatus?: string;
  tracks?: Array<{
    trackId?: string;
    timelineId?: string;
    trackType?: string;
    displayName?: string;
    sequence?: number;
    muted?: boolean;
    solo?: boolean;
    volumePercent?: number;
    clips?: Array<{
      clipId?: string;
      trackId?: string;
      assetId?: string;
      sourceRunId?: string;
      sequence?: number;
      startMs?: number;
      durationMs?: number;
      trimInMs?: number;
      trimOutMs?: number;
    }>;
  }>;
};

const TRACK_ORDER = ["dialogue", "voiceover", "bgm"] as const;

const AUDIO_ASSETS = [
  {
    assetId: "asset-audio-dialogue-1",
    uploadFileId: "upload-file-audio-dialogue-1",
    variantId: "variant-audio-dialogue-1",
    fileName: "dialogue.wav",
    mimeType: "audio/wav",
    durationMs: 12000,
    variantType: "master",
    sourceRunId: "run-audio-dialogue-1",
  },
  {
    assetId: "asset-audio-bgm-1",
    uploadFileId: "upload-file-audio-bgm-1",
    variantId: "variant-audio-bgm-1",
    fileName: "bgm.mp3",
    mimeType: "audio/mpeg",
    durationMs: 18000,
    variantType: "master",
    sourceRunId: "run-audio-bgm-1",
  },
] as const;

function getTrackDisplayName(trackType: string) {
  switch (trackType) {
    case "dialogue":
      return "对白";
    case "voiceover":
      return "旁白";
    case "bgm":
      return "配乐";
    default:
      return trackType || "音轨";
  }
}

export function createAudioTimelineState(projectId: string): AudioTimelineState {
  return {
    audioTimelineId: `timeline-${projectId}`,
    projectId,
    episodeId: "",
    status: "draft",
    renderWorkflowRunId: "workflow-audio-1",
    renderStatus: "queued",
    createdAt: "2026-03-24T08:00:00.000Z",
    updatedAt: "2026-03-24T08:05:00.000Z",
    tracks: [],
  };
}

export function buildAudioWorkbenchPayload(audioState: AudioTimelineState) {
  return {
    timeline: {
      audioTimelineId: audioState.audioTimelineId,
      projectId: audioState.projectId,
      episodeId: audioState.episodeId,
      status: audioState.status,
      renderWorkflowRunId: audioState.renderWorkflowRunId,
      renderStatus: audioState.renderStatus,
      createdAt: audioState.createdAt,
      updatedAt: audioState.updatedAt,
      tracks: audioState.tracks.map((track) => ({
        trackId: track.trackId,
        timelineId: track.timelineId,
        trackType: track.trackType,
        displayName: track.displayName,
        sequence: track.sequence,
        muted: track.muted,
        solo: track.solo,
        volumePercent: track.volumePercent,
        clips: track.clips.map((clip) => ({
          clipId: clip.clipId,
          trackId: clip.trackId,
          assetId: clip.assetId,
          sourceRunId: clip.sourceRunId,
          sequence: clip.sequence,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimInMs: clip.trimInMs,
          trimOutMs: clip.trimOutMs,
        })),
      })),
    },
  };
}

export function upsertAudioTimelineState(
  audioState: AudioTimelineState,
  body: UpsertAudioTimelineBody,
): AudioTimelineState {
  const normalizedTracks = TRACK_ORDER.map((trackType, trackIndex) => {
    const existingTrack = body.tracks?.find((track) => track.trackType === trackType);
    const trackId =
      existingTrack?.trackId && !existingTrack.trackId.startsWith("draft-track-")
        ? existingTrack.trackId
        : `track-${trackType}`;
    const normalizedClips = [...(existingTrack?.clips ?? [])]
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
      .map((clip, clipIndex) => ({
        clipId:
          clip.clipId && !clip.clipId.startsWith("draft-clip-")
            ? clip.clipId
            : `clip-${trackType}-${clipIndex + 1}`,
        trackId,
        assetId: clip.assetId ?? "",
        sourceRunId: clip.sourceRunId ?? "",
        sequence: clipIndex + 1,
        startMs: clip.startMs ?? 0,
        durationMs: clip.durationMs ?? 0,
        trimInMs: clip.trimInMs ?? 0,
        trimOutMs: clip.trimOutMs ?? 0,
      }));

    return {
      trackId,
      timelineId: audioState.audioTimelineId,
      trackType,
      displayName: existingTrack?.displayName ?? getTrackDisplayName(trackType),
      sequence: trackIndex + 1,
      muted: existingTrack?.muted ?? false,
      solo: existingTrack?.solo ?? false,
      volumePercent: existingTrack?.volumePercent ?? 100,
      clips: normalizedClips,
    };
  });

  return {
    ...audioState,
    projectId: body.projectId ?? audioState.projectId,
    status: body.status ?? audioState.status,
    renderWorkflowRunId: body.renderWorkflowRunId ?? audioState.renderWorkflowRunId,
    renderStatus: body.renderStatus ?? audioState.renderStatus,
    updatedAt: "2026-03-24T08:06:00.000Z",
    tracks: normalizedTracks,
  };
}

export function buildAudioImportBatchSummary(projectId: string) {
  return {
    id: "audio-batch-1",
    orgId: "org-live-1",
    projectId,
    operatorId: "user-live-1",
    sourceType: "upload_session",
    status: "confirmed",
    uploadSessionCount: 1,
    itemCount: AUDIO_ASSETS.length,
    confirmedItemCount: AUDIO_ASSETS.length,
    candidateAssetCount: AUDIO_ASSETS.length,
    mediaAssetCount: AUDIO_ASSETS.length,
    updatedAt: "2026-03-24T08:05:00.000Z",
  };
}

export function buildAudioImportBatchWorkbenchPayload(projectId: string) {
  return {
    importBatch: {
      id: "audio-batch-1",
      orgId: "org-live-1",
      projectId,
      operatorId: "user-live-1",
      sourceType: "upload_session",
      status: "confirmed",
    },
    uploadFiles: AUDIO_ASSETS.map((asset) => ({
      id: asset.uploadFileId,
      uploadSessionId: "upload-session-audio-1",
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      checksum: `sha256:${asset.assetId}`,
      sizeBytes: 2048,
    })),
    mediaAssets: AUDIO_ASSETS.map((asset) => ({
      id: asset.assetId,
      projectId,
      sourceType: "upload_session",
      rightsStatus: "clear",
      importBatchId: "audio-batch-1",
      locale: "zh-CN",
      aiAnnotated: true,
      mediaType: "audio",
    })),
    mediaAssetVariants: AUDIO_ASSETS.map((asset) => ({
      id: asset.variantId,
      assetId: asset.assetId,
      uploadFileId: asset.uploadFileId,
      variantType: asset.variantType,
      mimeType: asset.mimeType,
      width: 0,
      height: 0,
      durationMs: asset.durationMs,
    })),
    candidateAssets: AUDIO_ASSETS.map((asset, index) => ({
      id: `candidate-audio-${index + 1}`,
      assetId: asset.assetId,
      shotExecutionId: `shot-exec-audio-${index + 1}`,
      sourceRunId: asset.sourceRunId,
    })),
    shotExecutions: [],
  };
}

export function buildAudioAssetProvenancePayload(projectId: string, assetId: string) {
  const asset = AUDIO_ASSETS.find((candidate) => candidate.assetId === assetId);
  if (!asset) {
    return null;
  }

  return {
    asset: {
      id: asset.assetId,
      projectId,
      sourceType: "upload_session",
      rightsStatus: "clear",
      importBatchId: "audio-batch-1",
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary: `source_type=upload_session import_batch_id=audio-batch-1 rights_status=clear`,
    candidateAssetId: `candidate-${asset.assetId}`,
    shotExecutionId: `audio:${asset.assetId}`,
    sourceRunId: asset.sourceRunId,
    importBatchId: "audio-batch-1",
    variantCount: 1,
  };
}
