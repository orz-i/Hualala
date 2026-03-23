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

  it("keeps import precedence when both importBatchId and shotId are present", () => {
    expect(
      normalizeLegacyCreatorUrl({
        pathname: "/",
        search: "?importBatchId=batch-live-1&shotId=shot-live-1",
      } as Pick<Location, "pathname" | "search">),
    ).toBe("/imports?importBatchId=batch-live-1");
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
});
