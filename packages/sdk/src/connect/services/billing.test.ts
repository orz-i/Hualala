import { describe, expect, it, vi } from "vitest";
import { createBillingClient } from "./billing";

describe("createBillingClient", () => {
  it("calls billing unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            budgetSnapshot: {
              projectId: "project-1",
              limitCents: 120000,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            usageRecords: [{ id: "usage-1" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            billingEvents: [{ id: "event-1" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            budgetPolicy: {
              id: "budget-1",
              orgId: "org-1",
              projectId: "project-1",
              limitCents: 150000,
            },
          }),
          { status: 200 },
        ),
      );

    const client = createBillingClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        orgId: "org-1",
        userId: "user-1",
      },
    });

    await client.getBudgetSnapshot({ projectId: "project-1" });
    await client.listUsageRecords({ projectId: "project-1" });
    await client.listBillingEvents({ projectId: "project-1" });
    await client.updateBudgetPolicy({
      orgId: "org-1",
      projectId: "project-1",
      limitCents: 150000,
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.billing.v1.BillingService/GetBudgetSnapshot",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
        body: JSON.stringify({
          projectId: "project-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.billing.v1.BillingService/UpdateBudgetPolicy",
      expect.objectContaining({
        body: JSON.stringify({
          orgId: "org-1",
          projectId: "project-1",
          limitCents: 150000,
        }),
      }),
    );
  });
});
