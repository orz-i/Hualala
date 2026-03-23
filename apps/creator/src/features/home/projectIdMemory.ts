export const CREATOR_HOME_PROJECT_ID_STORAGE_KEY = "hualala.creator.last-project-id";

function normalizeProjectId(projectId: string | null | undefined) {
  const nextProjectId = projectId?.trim();
  return nextProjectId ? nextProjectId : null;
}

export function readRememberedProjectId(
  storage: Pick<Storage, "getItem"> | null | undefined = globalThis.localStorage,
) {
  return normalizeProjectId(storage?.getItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY));
}

export function rememberProjectId(
  projectId: string,
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined = globalThis.localStorage,
) {
  const nextProjectId = normalizeProjectId(projectId);
  if (!nextProjectId) {
    storage?.removeItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY);
    return;
  }

  storage?.setItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY, nextProjectId);
}
