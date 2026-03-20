export type SSEEventEnvelope = {
  id: string;
  eventType: string;
  data: unknown;
  rawData: string;
};

export type SSESubscription = {
  close: () => void;
};

export type SSESubscribeOptions = {
  organizationId: string;
  projectId: string;
  lastEventId?: string;
  onEvent: (event: SSEEventEnvelope) => void;
  onError?: (error: Error) => void;
};

export type SSEClient = {
  baseUrl: string;
  subscribeEvents: (options: SSESubscribeOptions) => SSESubscription;
};
