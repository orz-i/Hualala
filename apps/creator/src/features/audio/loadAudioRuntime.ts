import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAudioRuntime, type AudioRuntimeViewModel } from "../../../../shared/audio/audioRuntime";

type LoadAudioRuntimeOptions = {
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetAudioRuntimeResponse = {
  runtime?: Parameters<typeof normalizeAudioRuntime>[0];
};

export async function loadAudioRuntime({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAudioRuntimeOptions): Promise<AudioRuntimeViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.getAudioRuntime({
    projectId,
    ...(episodeId ? { episodeId } : {}),
  })) as GetAudioRuntimeResponse;

  return normalizeAudioRuntime(payload.runtime, "creator: audio runtime payload is incomplete");
}
