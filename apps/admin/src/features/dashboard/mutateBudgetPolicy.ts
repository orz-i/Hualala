import { createBillingClient, type HualalaFetch } from "@hualala/sdk";
type UpdateBudgetPolicyInput = {
  orgId: string;
  projectId: string;
  limitCents: number;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type UpdateBudgetPolicyResponse = {
  budgetPolicy?: {
    id?: string;
    orgId?: string;
    projectId?: string;
    limitCents?: number;
    reservedCents?: number;
  };
};

export type BudgetPolicySummary = {
  id: string;
  orgId: string;
  projectId: string;
  limitCents: number;
  reservedCents: number;
};

export async function updateBudgetPolicy({
  orgId,
  projectId,
  limitCents,
  baseUrl,
  fetchFn = fetch,
}: UpdateBudgetPolicyInput): Promise<BudgetPolicySummary> {
  const client = createBillingClient({
    baseUrl,
    fetchFn,
  });
  const payload = (await client.updateBudgetPolicy({
    orgId,
    projectId,
    limitCents,
  })) as UpdateBudgetPolicyResponse;

  return {
    id: payload.budgetPolicy?.id ?? "",
    orgId: payload.budgetPolicy?.orgId ?? orgId,
    projectId: payload.budgetPolicy?.projectId ?? projectId,
    limitCents: payload.budgetPolicy?.limitCents ?? limitCents,
    reservedCents: payload.budgetPolicy?.reservedCents ?? 0,
  };
}
