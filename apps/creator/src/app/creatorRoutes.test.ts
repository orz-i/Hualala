import {
  buildCreatorRouteUrl,
  normalizeLegacyCreatorUrl,
  parseCreatorRouteState,
  selectCreatorRoute,
} from "./creatorRoutes";

describe("creatorRoutes", () => {
  it("parses the root path as the home route", () => {
    expect(
      parseCreatorRouteState({
        pathname: "/",
        search: "",
      } as Pick<Location, "pathname" | "search">),
    ).toEqual({
      route: "home",
      projectId: undefined,
      shotId: undefined,
      importBatchId: undefined,
      orgId: undefined,
      userId: undefined,
    });
  });

  it("builds canonical shot urls without leaking home-only project state", () => {
    expect(
      buildCreatorRouteUrl({
        route: "shots",
        projectId: "project-home-1",
        shotId: "shot-live-1",
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    ).toBe("/shots?shotId=shot-live-1&orgId=org-live-1&userId=user-live-1");
  });

  it("normalizes legacy shot deep links to the canonical pathname", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/",
        search: "?shotId=shot-live-1&orgId=org-live-1&userId=user-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/shots?shotId=shot-live-1&orgId=org-live-1&userId=user-live-1");
  });

  it("keeps the collaboration pathname when a shot deep link targets /collab", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/collab",
        search: "?shotId=shot-live-1&orgId=org-live-1&userId=user-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/collab?shotId=shot-live-1&orgId=org-live-1&userId=user-live-1");
  });

  it("keeps the preview pathname when a project deep link targets /preview", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/preview",
        search: "?projectId=project-live-1&orgId=org-live-1&userId=user-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/preview?projectId=project-live-1&orgId=org-live-1&userId=user-live-1");
  });

  it("keeps the audio pathname when a project deep link targets /audio", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/audio",
        search: "?projectId=project-audio-1&orgId=org-live-1&userId=user-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/audio?projectId=project-audio-1&orgId=org-live-1&userId=user-live-1");
  });

  it("keeps the reuse pathname when a shot-scoped deep link targets /reuse", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/reuse",
        search:
          "?projectId=project-live-1&shotId=shot-live-1&sourceProjectId=project-source-9&orgId=org-live-1&userId=user-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe(
      "/reuse?projectId=project-live-1&shotId=shot-live-1&sourceProjectId=project-source-9&orgId=org-live-1&userId=user-live-1",
    );
  });

  it("keeps import precedence when both importBatchId and shotId are present", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/",
        search: "?importBatchId=batch-live-1&shotId=shot-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/imports?importBatchId=batch-live-1");
  });

  it("builds canonical preview urls with project and identity state", () => {
    expect(
      buildCreatorRouteUrl({
        route: "preview",
        projectId: "project-preview-1",
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    ).toBe("/preview?projectId=project-preview-1&orgId=org-live-1&userId=user-live-1");
  });

  it("builds canonical audio urls with project and identity state", () => {
    expect(
      buildCreatorRouteUrl({
        route: "audio",
        projectId: "project-audio-1",
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    ).toBe("/audio?projectId=project-audio-1&orgId=org-live-1&userId=user-live-1");
  });

  it("builds canonical reuse urls with target shot and external source project state", () => {
    expect(
      buildCreatorRouteUrl({
        route: "reuse",
        projectId: "project-live-1",
        shotId: "shot-live-1",
        sourceProjectId: "project-source-9",
        orgId: "org-live-1",
        userId: "user-live-1",
      }),
    ).toBe(
      "/reuse?projectId=project-live-1&shotId=shot-live-1&sourceProjectId=project-source-9&orgId=org-live-1&userId=user-live-1",
    );
  });

  it("drops route-local state when navigating back to home", () => {
    expect(
      selectCreatorRoute(
        {
          route: "imports",
          projectId: "project-home-1",
          importBatchId: "batch-live-1",
          shotId: "shot-live-1",
          orgId: "org-live-1",
          userId: "user-live-1",
        },
        "home",
      ),
    ).toEqual({
      route: "home",
      projectId: "project-home-1",
      shotId: undefined,
      importBatchId: undefined,
      orgId: "org-live-1",
      userId: "user-live-1",
    });
  });

  it("keeps project and identity state when navigating from home to preview", () => {
    expect(
      selectCreatorRoute(
        {
          route: "home",
          projectId: "project-preview-1",
          orgId: "org-live-1",
          userId: "user-live-1",
        },
        "preview",
      ),
    ).toEqual({
      route: "preview",
      projectId: "project-preview-1",
      shotId: undefined,
      importBatchId: undefined,
      orgId: "org-live-1",
      userId: "user-live-1",
    });
  });

  it("keeps project and identity state when navigating from home to audio", () => {
    expect(
      selectCreatorRoute(
        {
          route: "home",
          projectId: "project-audio-1",
          orgId: "org-live-1",
          userId: "user-live-1",
        },
        "audio",
      ),
    ).toEqual({
      route: "audio",
      projectId: "project-audio-1",
      shotId: undefined,
      importBatchId: undefined,
      orgId: "org-live-1",
      userId: "user-live-1",
    });
  });

  it("keeps target shot state when navigating from shots to reuse", () => {
    expect(
      selectCreatorRoute(
        {
          route: "shots",
          projectId: "project-live-1",
          shotId: "shot-live-1",
          orgId: "org-live-1",
          userId: "user-live-1",
        },
        "reuse",
      ),
    ).toEqual({
      route: "reuse",
      projectId: "project-live-1",
      shotId: "shot-live-1",
      importBatchId: undefined,
      orgId: "org-live-1",
      userId: "user-live-1",
    });
  });
});
