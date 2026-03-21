import {
  createAssetClient,
  createExecutionClient,
  createUploadClient,
  type HualalaFetch,
} from "@hualala/sdk";
import type { LocaleCode } from "../../i18n";

type ConfirmImportBatchItemsInput = {
  importBatchId: string;
  itemIds: string[];
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type SelectPrimaryAssetForImportBatchInput = {
  shotExecutionId: string;
  assetId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type CreateUploadSessionForImportBatchInput = {
  organizationId: string;
  projectId: string;
  importBatchId: string;
  fileName: string;
  checksum: string;
  sizeBytes: number;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type RetryUploadSessionForImportBatchInput = {
  sessionId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type CompleteUploadSessionForImportBatchInput = {
  sessionId: string;
  shotExecutionId: string;
  mimeType: string;
  locale: LocaleCode;
  width: number;
  height: number;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export type DerivedUploadFileMetadata = {
  file: File;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  checksum: string;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function resolveImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (!file.type.startsWith("image/")) {
    return { width: 0, height: 0 };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth || 0,
          height: image.naturalHeight || 0,
        });
      };
      image.onerror = () => {
        reject(new Error("creator: failed to read upload image dimensions"));
      };
      image.src = objectUrl;
    });

    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function deriveUploadFileMetadata(file: File): Promise<DerivedUploadFileMetadata> {
  const [arrayBuffer, dimensions] = await Promise.all([
    file.arrayBuffer(),
    resolveImageDimensions(file),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);

  return {
    file,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    width: dimensions.width,
    height: dimensions.height,
    checksum: `sha256:${toHex(new Uint8Array(digest))}`,
  };
}

export async function confirmImportBatchItems({
  importBatchId,
  itemIds,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: ConfirmImportBatchItemsInput): Promise<void> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.batchConfirmImportBatchItems({
    importBatchId,
    itemIds,
  });
}

export async function createUploadSessionForImportBatch({
  organizationId,
  projectId,
  importBatchId,
  fileName,
  checksum,
  sizeBytes,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: CreateUploadSessionForImportBatchInput) {
  const client = createUploadClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  return client.createSession({
    organization_id: organizationId,
    project_id: projectId,
    import_batch_id: importBatchId,
    file_name: fileName,
    checksum,
    size_bytes: sizeBytes,
    expires_in_seconds: 3600,
  });
}

export async function retryUploadSessionForImportBatch({
  sessionId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: RetryUploadSessionForImportBatchInput) {
  const client = createUploadClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  return client.retrySession(sessionId);
}

export async function completeUploadSessionForImportBatch({
  sessionId,
  shotExecutionId,
  mimeType,
  locale,
  width,
  height,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: CompleteUploadSessionForImportBatchInput) {
  const client = createUploadClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  return client.completeSession(sessionId, {
    shot_execution_id: shotExecutionId,
    variant_type: "original",
    mime_type: mimeType || "application/octet-stream",
    locale,
    rights_status: "clear",
    ai_annotated: true,
    width,
    height,
  });
}

export async function selectPrimaryAssetForImportBatch({
  shotExecutionId,
  assetId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: SelectPrimaryAssetForImportBatchInput): Promise<void> {
  const client = createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.selectPrimaryAsset({
    shotExecutionId,
    assetId,
  });
}
