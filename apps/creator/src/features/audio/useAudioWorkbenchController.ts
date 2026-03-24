import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import {
  resequenceAudioClips,
  resequenceAudioTracks,
  seedDraftTracks,
  type AudioAssetPoolItemViewModel,
  type AudioTrackViewModel,
  type AudioWorkbenchViewModel,
} from "./audioWorkbench";
import { loadAudioAssetPool } from "./loadAudioAssetPool";
import { loadAudioWorkbench } from "./loadAudioWorkbench";
import { saveAudioWorkbench } from "./mutateAudioWorkbench";

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

function buildClipStartMs(track: AudioTrackViewModel) {
  const lastClip = track.clips[track.clips.length - 1];
  if (!lastClip) {
    return 0;
  }
  return Math.max(0, lastClip.startMs + lastClip.durationMs);
}

export function useAudioWorkbenchController({
  enabled,
  projectId,
  t,
  orgId,
  userId,
}: {
  enabled: boolean;
  projectId: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
}) {
  const [audioWorkbench, setAudioWorkbench] = useState<AudioWorkbenchViewModel | null>(null);
  const [draftTracks, setDraftTracks] = useState<AudioTrackViewModel[]>([]);
  const [audioAssetPool, setAudioAssetPool] = useState<AudioAssetPoolItemViewModel[]>([]);
  const [audioAssetPoolErrorMessage, setAudioAssetPoolErrorMessage] = useState("");
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const draftClipIdRef = useRef(1);
  const {
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
    resetAssetProvenance,
  } = useAssetProvenanceState({
    t,
    orgId,
    userId,
  });

  useEffect(() => {
    if (!enabled) {
      resetAssetProvenance();
      startTransition(() => {
        setAudioWorkbench(null);
        setDraftTracks([]);
        setAudioAssetPool([]);
        setAudioAssetPoolErrorMessage("");
        setFeedback(null);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();

    Promise.allSettled([
      loadAudioWorkbench({
        projectId,
        orgId,
        userId,
      }),
      loadAudioAssetPool({
        projectId,
        orgId,
        userId,
      }),
    ])
      .then(([audioWorkbenchResult, audioAssetPoolResult]) => {
        if (cancelled) {
          return;
        }

        if (audioWorkbenchResult.status === "rejected") {
          const message = formatActionError(
            audioWorkbenchResult.reason,
            "creator: unknown audio workbench error",
          );
          startTransition(() => {
            setAudioWorkbench(null);
            setDraftTracks([]);
            setAudioAssetPool([]);
            setAudioAssetPoolErrorMessage("");
            setFeedback(null);
            setErrorMessage(message);
          });
          return;
        }

        const nextAudioAssetPool =
          audioAssetPoolResult.status === "fulfilled" ? audioAssetPoolResult.value : [];
        const nextAudioAssetPoolErrorMessage =
          audioAssetPoolResult.status === "rejected"
            ? formatActionError(
                audioAssetPoolResult.reason,
                "creator: unknown audio asset pool error",
              )
            : "";

        startTransition(() => {
          setAudioWorkbench(audioWorkbenchResult.value);
          setDraftTracks(seedDraftTracks(audioWorkbenchResult.value));
          setAudioAssetPool(nextAudioAssetPool);
          setAudioAssetPoolErrorMessage(nextAudioAssetPoolErrorMessage);
          setFeedback(null);
          setErrorMessage("");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, projectId, resetAssetProvenance, t, userId]);

  const handleAddClip = useCallback(
    (trackId: string, assetId: string) => {
      const asset = audioAssetPool.find((item) => item.assetId === assetId);
      if (!asset) {
        return;
      }

      setDraftTracks((currentTracks) =>
        resequenceAudioTracks(
          currentTracks.map((track) => {
            if (track.trackId !== trackId) {
              return track;
            }

            const nextClipId = `draft-clip-${draftClipIdRef.current}`;
            draftClipIdRef.current += 1;

            return {
              ...track,
              clips: resequenceAudioClips([
                ...track.clips,
                {
                  clipId: nextClipId,
                  trackId,
                  assetId: asset.assetId,
                  sourceRunId: asset.sourceRunId,
                  sequence: track.clips.length + 1,
                  startMs: buildClipStartMs(track),
                  durationMs: asset.durationMs,
                  trimInMs: 0,
                  trimOutMs: 0,
                },
              ]),
            };
          }),
        ),
      );
    },
    [audioAssetPool],
  );

  const handleRemoveClip = useCallback((trackId: string, clipId: string) => {
    setDraftTracks((currentTracks) =>
      resequenceAudioTracks(
        currentTracks.map((track) => {
          if (track.trackId !== trackId) {
            return track;
          }

          return {
            ...track,
            clips: resequenceAudioClips(track.clips.filter((clip) => clip.clipId !== clipId)),
          };
        }),
      ),
    );
  }, []);

  const handleMoveClip = useCallback((trackId: string, clipId: string, direction: "up" | "down") => {
    setDraftTracks((currentTracks) =>
      resequenceAudioTracks(
        currentTracks.map((track) => {
          if (track.trackId !== trackId) {
            return track;
          }

          const clipIndex = track.clips.findIndex((clip) => clip.clipId === clipId);
          if (clipIndex < 0) {
            return track;
          }

          const nextIndex = direction === "up" ? clipIndex - 1 : clipIndex + 1;
          if (nextIndex < 0 || nextIndex >= track.clips.length) {
            return track;
          }

          const nextClips = [...track.clips];
          const [movedClip] = nextClips.splice(clipIndex, 1);
          nextClips.splice(nextIndex, 0, movedClip);

          return {
            ...track,
            clips: resequenceAudioClips(nextClips),
          };
        }),
      ),
    );
  }, []);

  const handleTrackVolumeChange = useCallback((trackId: string, value: number) => {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.trackId === trackId
          ? {
              ...track,
              volumePercent: Math.max(0, Math.min(100, Math.trunc(value))),
            }
          : track,
      ),
    );
  }, []);

  const handleTrackMutedChange = useCallback((trackId: string, muted: boolean) => {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => (track.trackId === trackId ? { ...track, muted } : track)),
    );
  }, []);

  const handleTrackSoloChange = useCallback((trackId: string, solo: boolean) => {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => (track.trackId === trackId ? { ...track, solo } : track)),
    );
  }, []);

  const handleClipFieldChange = useCallback(
    (
      trackId: string,
      clipId: string,
      field: "startMs" | "durationMs" | "trimInMs" | "trimOutMs",
      value: number,
    ) => {
      setDraftTracks((currentTracks) =>
        currentTracks.map((track) => {
          if (track.trackId !== trackId) {
            return track;
          }
          return {
            ...track,
            clips: track.clips.map((clip) =>
              clip.clipId === clipId
                ? {
                    ...clip,
                    [field]: Math.max(0, Math.trunc(value)),
                  }
                : clip,
            ),
          };
        }),
      );
    },
    [],
  );

  const handleSaveTimeline = useCallback(async () => {
    if (!audioWorkbench) {
      return;
    }

    startTransition(() => {
      setFeedback({
        tone: "pending",
        message: t("feedback.pending.saveAudio"),
      });
    });

    try {
      await waitForFeedbackPaint();
      const nextWorkbench = await saveAudioWorkbench({
        projectId,
        status: audioWorkbench.timeline.status,
        renderWorkflowRunId: audioWorkbench.timeline.renderWorkflowRunId,
        renderStatus: audioWorkbench.timeline.renderStatus,
        tracks: draftTracks,
        orgId,
        userId,
      });
      startTransition(() => {
        setAudioWorkbench(nextWorkbench);
        setDraftTracks(seedDraftTracks(nextWorkbench));
        setFeedback({
          tone: "success",
          message: t("feedback.success.saveAudio"),
        });
        setErrorMessage("");
      });
    } catch (error: unknown) {
      const message = formatActionError(error, "creator: unknown audio save error");
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.saveAudio", { message }),
        });
      });
    }
  }, [audioWorkbench, draftTracks, orgId, projectId, t, userId]);

  return {
    audioWorkbench,
    draftTracks,
    audioAssetPool,
    audioAssetPoolErrorMessage,
    feedback,
    errorMessage,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleAddClip,
    handleRemoveClip,
    handleMoveClip,
    handleTrackVolumeChange,
    handleTrackMutedChange,
    handleTrackSoloChange,
    handleClipFieldChange,
    handleSaveTimeline,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
