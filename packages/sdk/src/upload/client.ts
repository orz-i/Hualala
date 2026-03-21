import { withIdentityHeaders } from "../connect/identity";
import {
  resolveConnectBaseUrl,
  type HualalaClientOptions,
  type HualalaFetch,
} from "../connect/transport";
import type {
  CompleteUploadSessionInput,
  CreateUploadSessionInput,
  UploadClient,
  UploadSessionResponse,
} from "./types";

async function assertUploadOk(response: Response, label: string) {
  if (response.ok) {
    return;
  }

  const text = await response.text();
  throw new Error(text.trim() || `${label} (${response.status})`);
}

async function parseUploadJson<T>(response: Response, label: string): Promise<T> {
  await assertUploadOk(response, label);
  return (await response.json()) as T;
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path}`;
}

export function createUploadClient(options: HualalaClientOptions = {}): UploadClient {
  const baseUrl = resolveConnectBaseUrl(options.baseUrl);
  const fetchFn: HualalaFetch = options.fetchFn ?? fetch;
  const identity = options.identity ?? {};

  return {
    baseUrl,
    async createSession(body: CreateUploadSessionInput) {
      const response = await fetchFn(joinUrl(baseUrl, "/upload/sessions"), {
        method: "POST",
        credentials: "include",
        headers: withIdentityHeaders(
          {
            "Content-Type": "application/json",
          },
          identity,
        ),
        body: JSON.stringify(body),
      });
      return parseUploadJson<UploadSessionResponse>(
        response,
        "sdk: failed to create upload session",
      );
    },
    async getSession(sessionId: string) {
      const response = await fetchFn(joinUrl(baseUrl, `/upload/sessions/${sessionId}`), {
        method: "GET",
        credentials: "include",
        headers: withIdentityHeaders({}, identity),
      });
      return parseUploadJson<UploadSessionResponse>(
        response,
        "sdk: failed to get upload session",
      );
    },
    async retrySession(sessionId: string) {
      const response = await fetchFn(
        joinUrl(baseUrl, `/upload/sessions/${sessionId}/retry`),
        {
          method: "POST",
          credentials: "include",
          headers: withIdentityHeaders({}, identity),
        },
      );
      return parseUploadJson<UploadSessionResponse>(
        response,
        "sdk: failed to retry upload session",
      );
    },
    async completeSession(sessionId: string, body: CompleteUploadSessionInput) {
      const response = await fetchFn(
        joinUrl(baseUrl, `/upload/sessions/${sessionId}/complete`),
        {
          method: "POST",
          credentials: "include",
          headers: withIdentityHeaders(
            {
              "Content-Type": "application/json",
            },
            identity,
          ),
          body: JSON.stringify(body),
        },
      );
      return parseUploadJson<UploadSessionResponse>(
        response,
        "sdk: failed to complete upload session",
      );
    },
  };
}
