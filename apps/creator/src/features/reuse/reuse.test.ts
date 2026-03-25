import { describe, expect, it } from "vitest";
import { decideReuseEligibility } from "./reuse";

describe("decideReuseEligibility", () => {
  it("fails closed when the source project is missing", () => {
    expect(
      decideReuseEligibility({
        currentProjectId: "project-live-1",
        sourceProjectId: "",
        rightsStatus: "clear",
        consentStatus: "not_required",
        aiAnnotated: false,
      }),
    ).toEqual({
      allowed: false,
      blockedReason: "policyapp: source project is unavailable for cross-project reuse",
      consentStatus: "not_required",
    });
  });
});
