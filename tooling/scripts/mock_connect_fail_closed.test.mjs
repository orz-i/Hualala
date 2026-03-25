import test from "node:test";
import assert from "node:assert/strict";

import { mockConnectRoutes } from "../../tests/e2e/fixtures/mockConnectRoutes.ts";

function createStubPage() {
  const handlers = [];
  const contextHandlers = [];

  return {
    handlers,
    contextHandlers,
    async route(pattern, handler) {
      handlers.push({ pattern, handler });
    },
    context() {
      return {
        route(pattern, handler) {
          contextHandlers.push({ pattern, handler });
        },
      };
    },
  };
}

function createStubRoute(url) {
  const events = [];

  return {
    events,
    request() {
      return {
        url() {
          return url;
        },
        postDataJSON() {
          return {};
        },
      };
    },
    async fulfill(response) {
      events.push({ type: "fulfill", response });
    },
    async continue() {
      events.push({ type: "continue" });
    },
  };
}

test("mock connect routes fail closed for unexpected connect RPCs", async () => {
  const page = createStubPage();
  await mockConnectRoutes(page, {});

  const connectRoute = page.handlers.find(({ pattern }) => pattern instanceof RegExp && pattern.test("/hualala.auth.v1.AuthService/GetCurrentSession"));
  assert.ok(connectRoute, "expected connect route handler to be registered");

  const route = createStubRoute("http://127.0.0.1:8080/hualala.workflow.v1.WorkflowService/UnexpectedRpc");
  await connectRoute.handler(route);

  assert.deepEqual(route.events, [
    {
      type: "fulfill",
      response: {
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({
          error: "mock connect route not implemented",
          pathname: "/hualala.workflow.v1.WorkflowService/UnexpectedRpc",
        }),
      },
    },
  ]);
});
