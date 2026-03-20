type UpdateBudgetPolicyInput = {
  orgId: string;
  projectId: string;
  limitCents: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
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

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveBaseUrl(baseUrl?: string) {
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

export async function updateBudgetPolicy({
  orgId,
  projectId,
  limitCents,
  baseUrl,
  fetchFn = fetch,
}: UpdateBudgetPolicyInput): Promise<BudgetPolicySummary> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.billing.v1.BillingService/UpdateBudgetPolicy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        orgId,
        projectId,
        limitCents,
      }),
    },
  );

  await assertConnectOk(response, "admin: failed to update budget policy");
  const payload = (await response.json()) as UpdateBudgetPolicyResponse;

  return {
    id: payload.budgetPolicy?.id ?? "",
    orgId: payload.budgetPolicy?.orgId ?? orgId,
    projectId: payload.budgetPolicy?.projectId ?? projectId,
    limitCents: payload.budgetPolicy?.limitCents ?? limitCents,
    reservedCents: payload.budgetPolicy?.reservedCents ?? 0,
  };
}
