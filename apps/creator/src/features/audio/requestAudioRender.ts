import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import { normalizeAudioRuntime, type AudioRuntimeViewModel } from "../../../../shared/audio/audioRuntime";

type RequestAudioRenderOptions = {
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type RequestAudioRenderResponse = {
  runtime?: Parameters<typeof normalizeAudioRuntime>[0];
};

export async function requestAudioRender({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: RequestAudioRenderOptions): Promise<AudioRuntimeViewModel> {
  const client = createProjectClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const payload = (await client.requestAudioRender({
    projectId,
    ...(episodeId ? { episodeId } : {}),
  })) as RequestAudioRenderResponse;

  return normalizeAudioRuntime(payload.runtime, "creator: audio runtime payload is incomplete");
}
