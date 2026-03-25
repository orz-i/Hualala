import { createProjectClient, type HualalaFetch } from "@hualala/sdk";
import {
  normalizeAdminAudioRuntime,
  type AdminAudioRuntimeViewModel,
} from "./adminAudioRuntime";

type LoadAdminAudioRuntimeOptions = {
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetAudioRuntimeResponse = {
  runtime?: Parameters<typeof normalizeAdminAudioRuntime>[0];
};

export async function loadAdminAudioRuntime({
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminAudioRuntimeOptions): Promise<AdminAudioRuntimeViewModel> {
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

  return normalizeAdminAudioRuntime(payload.runtime, "admin: audio runtime payload is incomplete");
}
