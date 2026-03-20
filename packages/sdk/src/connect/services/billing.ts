import type {
  GetBudgetSnapshotResponse,
  ListBillingEventsResponse,
  ListUsageRecordsResponse,
  UpdateBudgetPolicyResponse,
} from "../../gen/hualala/billing/v1/billing_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export function createBillingClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    getBudgetSnapshot(body: { projectId: string }) {
      return client.unary<GetBudgetSnapshotResponse>(
        "/hualala.billing.v1.BillingService/GetBudgetSnapshot",
        body,
        "sdk: failed to get budget snapshot",
      );
    },
    listUsageRecords(body: { projectId: string }) {
      return client.unary<ListUsageRecordsResponse>(
        "/hualala.billing.v1.BillingService/ListUsageRecords",
        body,
        "sdk: failed to list usage records",
      );
    },
    listBillingEvents(body: { projectId: string }) {
      return client.unary<ListBillingEventsResponse>(
        "/hualala.billing.v1.BillingService/ListBillingEvents",
        body,
        "sdk: failed to list billing events",
      );
    },
    updateBudgetPolicy(body: {
      orgId: string;
      projectId: string;
      limitCents: number;
    }) {
      return client.unary<UpdateBudgetPolicyResponse>(
        "/hualala.billing.v1.BillingService/UpdateBudgetPolicy",
        body,
        "sdk: failed to update budget policy",
      );
    },
  };
}
