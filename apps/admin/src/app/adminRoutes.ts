export type AdminRoute = "overview" | "workflow" | "assets" | "governance" | "collaboration";

export type AdminRouteState = {
  route: AdminRoute;
  projectId: string;
  shotExecutionId: string;
  orgId?: string;
  userId?: string;
  workflowRunId?: string;
  importBatchId?: string;
  assetId?: string;
  shotId?: string;
};

const defaultProjectId = "project-demo-001";
const defaultShotExecutionId = "shot-exec-demo-001";

const routePathMap: Record<AdminRoute, string> = {
  overview: "/overview",
  workflow: "/workflow",
  assets: "/assets",
  governance: "/governance",
  collaboration: "/collaboration",
};

function normalizeAdminRoute(pathname: string): AdminRoute {
  const normalizedPathname = pathname.toLowerCase();
  if (normalizedPathname === routePathMap.workflow) {
    return "workflow";
  }
  if (normalizedPathname === routePathMap.assets) {
    return "assets";
  }
  if (normalizedPathname === routePathMap.governance) {
    return "governance";
  }
  if (normalizedPathname === routePathMap.collaboration) {
    return "collaboration";
  }
  return "overview";
}

export function parseAdminRouteState(locationLike: Pick<Location, "pathname" | "search">) {
  const searchParams = new URLSearchParams(locationLike.search);
  return {
    route: normalizeAdminRoute(locationLike.pathname),
    projectId: searchParams.get("projectId") ?? defaultProjectId,
    shotExecutionId: searchParams.get("shotExecutionId") ?? defaultShotExecutionId,
    orgId: searchParams.get("orgId") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    workflowRunId: searchParams.get("workflowRunId") ?? undefined,
    importBatchId: searchParams.get("importBatchId") ?? undefined,
    assetId: searchParams.get("assetId") ?? undefined,
    shotId: searchParams.get("shotId") ?? undefined,
  } satisfies AdminRouteState;
}

export function buildAdminRouteUrl(state: AdminRouteState) {
  const searchParams = new URLSearchParams();
  searchParams.set("projectId", state.projectId);
  searchParams.set("shotExecutionId", state.shotExecutionId);

  if (state.orgId) {
    searchParams.set("orgId", state.orgId);
  }
  if (state.userId) {
    searchParams.set("userId", state.userId);
  }

  if (state.route === "workflow" && state.workflowRunId) {
    searchParams.set("workflowRunId", state.workflowRunId);
  }

  if (state.route === "assets") {
    if (state.importBatchId) {
      searchParams.set("importBatchId", state.importBatchId);
      if (state.assetId) {
        searchParams.set("assetId", state.assetId);
      }
    }
  }

  if (state.route === "collaboration" && state.shotId) {
    searchParams.set("shotId", state.shotId);
  }

  return `${routePathMap[state.route]}?${searchParams.toString()}`;
}

export function selectAdminRoute(state: AdminRouteState, route: AdminRoute): AdminRouteState {
  return {
    ...state,
    route,
    workflowRunId: undefined,
    importBatchId: undefined,
    assetId: undefined,
    shotId: route === "collaboration" ? state.shotId : undefined,
  };
}
