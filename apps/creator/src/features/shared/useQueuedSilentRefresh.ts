import { useCallback, useRef } from "react";

type SilentRefreshScope = "shot" | "import" | "collaboration" | "preview-runtime";

export function useQueuedSilentRefresh(
  scope: SilentRefreshScope,
  refresh: () => Promise<unknown>,
) {
  const refreshStateRef = useRef({
    inFlight: false,
    queued: false,
  });

  return useCallback(() => {
    const state = refreshStateRef.current;
    if (state.inFlight) {
      state.queued = true;
      return;
    }

    state.inFlight = true;
    const runRefresh = async () => {
      try {
        await refresh();
      } catch (error: unknown) {
        console.warn(`creator: ${scope} sse refresh failed`, error);
      } finally {
        if (state.queued) {
          state.queued = false;
          void runRefresh();
          return;
        }
        state.inFlight = false;
      }
    };

    void runRefresh();
  }, [refresh, scope]);
}
