import {
  createSessionBootstrap,
  isUnauthenticatedSessionError,
  type SessionViewModel,
} from "@hualala/sdk";

const sessionBootstrap = createSessionBootstrap("admin");

export type { SessionViewModel };

export const loadCurrentSession = sessionBootstrap.loadCurrentSession;
export const ensureDevSession = sessionBootstrap.ensureDevSession;
export const clearCurrentSession = sessionBootstrap.clearCurrentSession;
export { isUnauthenticatedSessionError };
