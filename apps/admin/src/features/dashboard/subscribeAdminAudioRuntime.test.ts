import { createSSEClient } from "@hualala/sdk";
import { subscribeAdminAudioRuntime } from "./subscribeAdminAudioRuntime";

type SubscribeOptions = Parameters<
  ReturnType<typeof createSSEClient>["subscribeEvents"]
>[0];

const { closeMock, createSSEClientMock, subscribeEventsMock } = vi.hoisted(() => {
  const closeMock = vi.fn();
  const subscribeEventsMock = vi.fn((_options: SubscribeOptions) => ({
    close: closeMock,
  }));
  const createSSEClientMock = vi.fn(() => ({
    subscribeEvents: subscribeEventsMock,
  }));

  return {
    closeMock,
    createSSEClientMock,
    subscribeEventsMock,
  };
});

vi.mock("@hualala/sdk", () => ({
  createSSEClient: createSSEClientMock,
}));

describe("subscribeAdminAudioRuntime", () => {
  beforeEach(() => {
    closeMock.mockClear();
    createSSEClientMock.mockClear();
    subscribeEventsMock.mockClear();
  });

  it("refreshes admin audio runtime only for audio runtime events in the active scope", () => {
    const onRefreshNeeded = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeAdminAudioRuntime({
      organizationId: "org-1",
      projectId: "project-1",
      episodeId: "",
      onRefreshNeeded,
      onError,
    });

    expect(subscribeEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        projectId: "project-1",
        onError,
      }),
    );

    const options = subscribeEventsMock.mock.calls[0]?.[0] as SubscribeOptions;
    options.onEvent({
      id: "event-1",
      eventType: "project.audio.runtime.updated",
      rawData: "",
      data: {
        episode_id: "",
      },
    });
    options.onEvent({
      id: "event-2",
      eventType: "asset.import_batch.updated",
      rawData: "",
      data: {},
    });

    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
