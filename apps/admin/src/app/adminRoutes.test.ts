import {
  buildAdminRouteUrl,
  parseAdminRouteState,
  selectAdminRoute,
} from "./adminRoutes";

describe("adminRoutes", () => {
  it("normalizes the root path to the overview route with default ids", () => {
    expect(
      parseAdminRouteState({
        pathname: "/",
        search: "",
      } as Pick<Location, "pathname" | "search">),
    ).toEqual({
      route: "overview",
      projectId: "project-demo-001",
      shotExecutionId: "shot-exec-demo-001",
      orgId: undefined,
      userId: undefined,
      workflowRunId: undefined,
      importBatchId: undefined,
      assetId: undefined,
    });
  });

  it("builds workflow urls with common params and route-local workflow detail state", () => {
    expect(
      buildAdminRouteUrl({
        route: "workflow",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        orgId: "org-live-001",
        userId: "user-live-001",
        workflowRunId: "workflow-run-1",
      }),
    ).toBe(
      "/workflow?projectId=project-live-001&shotExecutionId=shot-exec-live-001&orgId=org-live-001&userId=user-live-001&workflowRunId=workflow-run-1",
    );
  });

  it("drops asset provenance query state when no import batch is selected", () => {
    expect(
      buildAdminRouteUrl({
        route: "assets",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        assetId: "asset-live-1",
      }),
    ).toBe("/assets?projectId=project-live-001&shotExecutionId=shot-exec-live-001");
  });

  it("clears route-specific detail state when switching routes", () => {
    expect(
      selectAdminRoute(
        {
          route: "assets",
          projectId: "project-live-001",
          shotExecutionId: "shot-exec-live-001",
          importBatchId: "batch-live-1",
          assetId: "asset-live-1",
        },
        "governance",
      ),
    ).toEqual({
      route: "governance",
      projectId: "project-live-001",
      shotExecutionId: "shot-exec-live-001",
      workflowRunId: undefined,
      importBatchId: undefined,
      assetId: undefined,
    });
  });
});
