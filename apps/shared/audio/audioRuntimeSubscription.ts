export type AudioRuntimeEventEnvelope = {
  eventType: string;
  data: unknown;
};

function readPayloadString(payload: unknown, ...keys: string[]) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return "";
}

export function matchesAudioRuntimeScope(
  event: AudioRuntimeEventEnvelope,
  episodeId: string | undefined,
) {
  if (event.eventType !== "project.audio.runtime.updated") {
    return false;
  }

  const expectedEpisodeId = (episodeId ?? "").trim();
  const actualEpisodeId = readPayloadString(event.data, "episode_id", "episodeId");

  if (!expectedEpisodeId) {
    return actualEpisodeId === "";
  }

  return actualEpisodeId === expectedEpisodeId;
}
