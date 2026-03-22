import { act, renderHook, waitFor } from "@testing-library/react";
import { createAssetMonitor } from "../assetMonitor.test-data";
import { loadAssetMonitorPanel } from "../loadAssetMonitorPanel";
import { useAssetMonitorState } from "./useAssetMonitorState";

vi.mock("../loadAssetMonitorPanel", () => ({
  loadAssetMonitorPanel: vi.fn(),
}));

const loadAssetMonitorPanelMock = vi.mocked(loadAssetMonitorPanel);

describe("useAssetMonitorState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the asset monitor when the session is ready and reloads when filters change", async () => {
    loadAssetMonitorPanelMock
      .mockResolvedValueOnce(createAssetMonitor("project-live-001"))
      .mockResolvedValueOnce({
        ...createAssetMonitor("project-live-001"),
        filters: {
          status: "confirmed",
          sourceType: "",
        },
      });

    const { result } = renderHook(() =>
      useAssetMonitorState({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toHaveLength(1);
    });

    act(() => {
      result.current.onAssetStatusFilterChange("confirmed");
    });

    await waitFor(() => {
      expect(result.current.assetMonitor.filters.status).toBe("confirmed");
    });

    expect(loadAssetMonitorPanelMock).toHaveBeenNthCalledWith(1, {
      projectId: "project-live-001",
      status: "",
      sourceType: "",
      orgId: undefined,
      userId: undefined,
    });
    expect(loadAssetMonitorPanelMock).toHaveBeenNthCalledWith(2, {
      projectId: "project-live-001",
      status: "confirmed",
      sourceType: "",
      orgId: undefined,
      userId: undefined,
    });
  });

  it("resets to an empty monitor when the session is not ready and falls back to empty on loader failure", async () => {
    loadAssetMonitorPanelMock.mockRejectedValueOnce(new Error("asset monitor exploded"));

    const { result, rerender } = renderHook(
      (props: { sessionState: "loading" | "ready" | "unauthenticated" }) =>
        useAssetMonitorState({
          sessionState: props.sessionState,
          projectId: "project-live-001",
          identityOverride: {
            orgId: "org-demo-001",
            userId: "user-demo-001",
          },
        }),
      {
        initialProps: {
          sessionState: "ready",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.assetMonitor.importBatches).toEqual([]);
    });

    rerender({
      sessionState: "unauthenticated",
    });

    expect(result.current.assetMonitor.importBatches).toEqual([]);
    expect(result.current.assetMonitor.filters).toEqual({
      status: "",
      sourceType: "",
    });
  });
});
