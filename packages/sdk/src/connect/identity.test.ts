import { describe, expect, it } from "vitest";
import { buildIdentityHeaders, withIdentityHeaders } from "./identity";

describe("sdk identity headers", () => {
  it("injects org and user headers when provided", () => {
    expect(buildIdentityHeaders({ orgId: "org-1", userId: "user-1" })).toEqual({
      "X-Hualala-Org-Id": "org-1",
      "X-Hualala-User-Id": "user-1",
    });
  });

  it("keeps headers empty when identity is omitted", () => {
    expect(buildIdentityHeaders({})).toEqual({});
  });

  it("merges existing headers with identity headers", () => {
    expect(
      withIdentityHeaders(
        { "Content-Type": "application/json" },
        { orgId: "org-1", userId: "user-1" },
      ),
    ).toEqual({
      "Content-Type": "application/json",
      "X-Hualala-Org-Id": "org-1",
      "X-Hualala-User-Id": "user-1",
    });
  });
});
