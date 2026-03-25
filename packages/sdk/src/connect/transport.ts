import { withIdentityHeaders, type DevIdentity } from "./identity";
import { createSSEClient } from "../sse/client";
import { createUploadClient } from "../upload/client";
import type {
  CancelWorkflowRunResponse,
  GetWorkflowRunResponse,
  ListWorkflowRunsResponse,
  RetryWorkflowRunResponse,
  StartWorkflowResponse,
} from "../gen/hualala/workflow/v1/workflow_pb";

export type HualalaFetch = typeof fetch;

export type HualalaClientOptions = {
  baseUrl?: string;
  fetchFn?: HualalaFetch;
  identity?: DevIdentity;
};

export function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveConnectBaseUrl(baseUrl?: string) {
  if (baseUrl && baseUrl.trim() !== "") {
    return trimTrailingSlash(baseUrl.trim());
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return "";
}

async function assertConnectOk(response: Response, label: string) {
  if (response.ok) {
    return;
  }
  let detail = "";
  const text = await response.text();
  if (text.trim() !== "") {
    try {
      const payload = JSON.parse(text) as {
        code?: string;
        message?: string;
        error?: {
          code?: string;
          message?: string;
        };
      };
      const code = payload.code ?? payload.error?.code ?? "";
      const message = payload.message ?? payload.error?.message ?? "";
      detail = [code, message].filter((value) => value && value.trim() !== "").join(" ");
    } catch {
      detail = text.trim();
    }
  }
  throw new Error(detail ? `${label} (${response.status}) ${detail}` : `${label} (${response.status})`);
}

export type HualalaClient = {
  baseUrl: string;
  identity: DevIdentity;
  unary<TResponse>(path: string, body: Record<string, unknown>, label?: string): Promise<TResponse>;
  sse: ReturnType<typeof createSSEClient>;
  upload: ReturnType<typeof createUploadClient>;
  workflow: {
    startWorkflow(body: {
      organizationId: string;
      projectId: string;
      workflowType: string;
      resourceId: string;
    }): Promise<StartWorkflowResponse>;
    getWorkflowRun(body: { workflowRunId: string }): Promise<GetWorkflowRunResponse>;
    listWorkflowRuns(body: {
      projectId: string;
      resourceId?: string;
      status?: string;
      workflowType?: string;
    }): Promise<ListWorkflowRunsResponse>;
    cancelWorkflowRun(body: { workflowRunId: string }): Promise<CancelWorkflowRunResponse>;
    retryWorkflowRun(body: { workflowRunId: string }): Promise<RetryWorkflowRunResponse>;
  };
};

export function createHualalaClient(options: HualalaClientOptions = {}): HualalaClient {
  const baseUrl = resolveConnectBaseUrl(options.baseUrl);
  const fetchFn = options.fetchFn ?? fetch;
  const identity = options.identity ?? {};
  const unary = async <TResponse>(
    path: string,
    body: Record<string, unknown>,
    label = `sdk: failed to call ${path}`,
  ) => {
    const response = await fetchFn(`${baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: withIdentityHeaders(
        {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        identity,
      ),
      body: JSON.stringify(body),
    });

    await assertConnectOk(response, label);
    const text = await response.text();
    if (text.trim() === "") {
      return {} as TResponse;
    }
    return JSON.parse(text) as TResponse;
  };

  return {
    baseUrl,
    identity,
    sse: createSSEClient({
      baseUrl,
      fetchFn,
      identity,
    }),
    upload: createUploadClient({
      baseUrl,
      fetchFn,
      identity,
    }),
    workflow: {
      startWorkflow(body) {
        return unary<StartWorkflowResponse>(
          "/hualala.workflow.v1.WorkflowService/StartWorkflow",
          body,
          "sdk: failed to start workflow",
        );
      },
      getWorkflowRun(body) {
        return unary<GetWorkflowRunResponse>(
          "/hualala.workflow.v1.WorkflowService/GetWorkflowRun",
          body,
          "sdk: failed to get workflow run",
        );
      },
      listWorkflowRuns(body) {
        return unary<ListWorkflowRunsResponse>(
          "/hualala.workflow.v1.WorkflowService/ListWorkflowRuns",
          body,
          "sdk: failed to list workflow runs",
        );
      },
      cancelWorkflowRun(body) {
        return unary<CancelWorkflowRunResponse>(
          "/hualala.workflow.v1.WorkflowService/CancelWorkflowRun",
          body,
          "sdk: failed to cancel workflow run",
        );
      },
      retryWorkflowRun(body) {
        return unary<RetryWorkflowRunResponse>(
          "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun",
          body,
          "sdk: failed to retry workflow run",
        );
      },
    },
    unary,
  };
}
