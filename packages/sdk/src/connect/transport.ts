import { withIdentityHeaders, type DevIdentity } from "./identity";
import { createSSEClient } from "../sse/client";
import { createUploadClient } from "../upload/client";

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
  throw new Error(`${label} (${response.status})`);
}

export type HualalaClient = {
  baseUrl: string;
  identity: DevIdentity;
  unary<TResponse>(path: string, body: Record<string, unknown>, label?: string): Promise<TResponse>;
  sse: ReturnType<typeof createSSEClient>;
  upload: ReturnType<typeof createUploadClient>;
};

export function createHualalaClient(options: HualalaClientOptions = {}): HualalaClient {
  const baseUrl = resolveConnectBaseUrl(options.baseUrl);
  const fetchFn = options.fetchFn ?? fetch;
  const identity = options.identity ?? {};

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
    async unary<TResponse>(path: string, body: Record<string, unknown>, label = `sdk: failed to call ${path}`) {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method: "POST",
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
    },
  };
}
