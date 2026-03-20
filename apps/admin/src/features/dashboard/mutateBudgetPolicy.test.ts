import { createBillingClient } from "@hualala/sdk";
import { updateBudgetPolicy } from "./mutateBudgetPolicy";

vi.mock("@hualala/sdk", () => ({
  createBillingClient: vi.fn(),
}));

describe("mutateBudgetPolicy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updates budget policy via the sdk billing client", async () => {
    const updateBudgetPolicyMock = vi.fn().mockResolvedValue({
      budgetPolicy: {
        id: "budget-1",
        orgId: "org-live-1",
        projectId: "project-live-1",
        limitCents: 150000,
        reservedCents: 18000,
      },
    });
    vi.mocked(createBillingClient).mockReturnValue({
      updateBudgetPolicy: updateBudgetPolicyMock,
    } as never);

    const result = await updateBudgetPolicy({
      orgId: "org-live-1",
      projectId: "project-live-1",
      limitCents: 150000,
      baseUrl: "http://localhost:8080/",
      fetchFn: vi.fn(),
    });

    expect(createBillingClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://localhost:8080/",
      }),
    );
    expect(updateBudgetPolicyMock).toHaveBeenCalledWith({
      orgId: "org-live-1",
      projectId: "project-live-1",
      limitCents: 150000,
    });
    expect(result.limitCents).toBe(150000);
  });
});
