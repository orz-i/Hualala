import type { SSEEventEnvelope } from "./types";

type ParsedBlock = {
  event?: SSEEventEnvelope;
  remaining: string;
};

function normalizeBuffer(buffer: string) {
  return buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseBlock(block: string): SSEEventEnvelope | null {
  let id = "";
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.trim() === "" || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (id === "" && dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join("\n");
  let data: unknown = rawData;
  if (rawData.trim() !== "") {
    try {
      data = JSON.parse(rawData);
    } catch {
      data = rawData;
    }
  }

  return {
    id,
    eventType,
    data,
    rawData,
  };
}

export function parseEventStreamChunk(buffer: string): ParsedBlock {
  const normalized = normalizeBuffer(buffer);
  const boundaryIndex = normalized.indexOf("\n\n");
  if (boundaryIndex === -1) {
    return {
      remaining: normalized,
    };
  }

  const block = normalized.slice(0, boundaryIndex);
  return {
    event: parseBlock(block) ?? undefined,
    remaining: normalized.slice(boundaryIndex + 2),
  };
}
