export type CreatorRoute = "home" | "shots" | "imports";

export type CreatorRouteState = {
  route: CreatorRoute;
  projectId?: string;
  shotId?: string;
  importBatchId?: string;
  orgId?: string;
  userId?: string;
};

const routePathMap: Record<CreatorRoute, string> = {
  home: "/",
  shots: "/shots",
  imports: "/imports",
};

function normalizeValue(value: string | null | undefined) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
}

function normalizeCreatorRoute(pathname: string): CreatorRoute {
  const normalizedPathname = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (normalizedPathname === routePathMap.imports) {
    return "imports";
  }
  if (normalizedPathname === routePathMap.shots) {
    return "shots";
  }
  return "home";
}

export function parseCreatorRouteState(locationLike: Pick<Location, "pathname" | "search">) {
  const searchParams = new URLSearchParams(locationLike.search);
  const projectId = normalizeValue(searchParams.get("projectId"));
  const importBatchId = normalizeValue(searchParams.get("importBatchId"));
  const shotId = normalizeValue(searchParams.get("shotId"));
  const orgId = normalizeValue(searchParams.get("orgId"));
  const userId = normalizeValue(searchParams.get("userId"));
  const requestedRoute = normalizeCreatorRoute(locationLike.pathname);

  if (importBatchId) {
    return {
      route: "imports",
      projectId,
      importBatchId,
      shotId: undefined,
      orgId,
      userId,
    } satisfies CreatorRouteState;
  }

  if (shotId) {
    return {
      route: "shots",
      projectId,
      shotId,
      importBatchId: undefined,
      orgId,
      userId,
    } satisfies CreatorRouteState;
  }

  if (requestedRoute === "home") {
    return {
      route: "home",
      projectId,
      shotId: undefined,
      importBatchId: undefined,
      orgId,
      userId,
    } satisfies CreatorRouteState;
  }

  return {
    route: "home",
    projectId,
    shotId: undefined,
    importBatchId: undefined,
    orgId,
    userId,
  } satisfies CreatorRouteState;
}

export function buildCreatorRouteUrl(state: CreatorRouteState) {
  const searchParams = new URLSearchParams();

  if (state.route === "home" && state.projectId) {
    searchParams.set("projectId", state.projectId);
  }

  if (state.route === "shots" && state.shotId) {
    searchParams.set("shotId", state.shotId);
  }

  if (state.route === "imports" && state.importBatchId) {
    searchParams.set("importBatchId", state.importBatchId);
  }

  if (state.orgId) {
    searchParams.set("orgId", state.orgId);
  }

  if (state.userId) {
    searchParams.set("userId", state.userId);
  }

  const search = searchParams.toString();
  return `${routePathMap[state.route]}${search ? `?${search}` : ""}`;
}

export function normalizeLegacyCreatorUrl(locationLike: Pick<Location, "pathname" | "search">) {
  return buildCreatorRouteUrl(parseCreatorRouteState(locationLike));
}

export function selectCreatorRoute(
  state: CreatorRouteState,
  route: CreatorRoute,
): CreatorRouteState {
  if (route === "home") {
    return {
      ...state,
      route,
      shotId: undefined,
      importBatchId: undefined,
    };
  }

  if (route === "shots") {
    return {
      ...state,
      route,
      importBatchId: undefined,
    };
  }

  return {
    ...state,
    route,
    shotId: undefined,
  };
}
