import { updateBudgetPolicy } from "./mutateBudgetPolicy";

describe("mutateBudgetPolicy", () => {
  it("posts budget policy updates with connect protocol headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          budgetPolicy: {
            id: "budget-1",
            orgId: "org-live-1",
            projectId: "project-live-1",
            limitCents: 150000,
            reservedCents: 18000,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await updateBudgetPolicy({
      orgId: "org-live-1",
      projectId: "project-live-1",
      limitCents: 150000,
      baseUrl: "http://localhost:8080/",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/hualala.billing.v1.BillingService/UpdateBudgetPolicy",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify({
          orgId: "org-live-1",
          projectId: "project-live-1",
          limitCents: 150000,
        }),
      },
    );
    expect(result.limitCents).toBe(150000);
  });
});
