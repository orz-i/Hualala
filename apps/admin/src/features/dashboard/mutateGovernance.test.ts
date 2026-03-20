import {
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "./mutateGovernance";

describe("mutateGovernance", () => {
  it("posts user preferences with connect headers and dev identity", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          preferences: {
            userId: "user-1",
            displayLocale: "en-US",
            timezone: "America/Los_Angeles",
          },
        }),
        { status: 200 },
      ),
    );

    await updateUserPreferences({
      orgId: "org-1",
      userId: "user-1",
      displayLocale: "en-US",
      timezone: "America/Los_Angeles",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.auth.v1.AuthService/UpdateUserPreferences",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
      }),
    );
  });

  it("posts org governance updates through the dedicated mutations", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            member: { memberId: "member-1", orgId: "org-1", userId: "user-1", roleId: "role-editor" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            localeSettings: { orgId: "org-1", defaultLocale: "en-US", supportedLocales: ["en-US"] },
          }),
          { status: 200 },
        ),
      );

    const member = await updateMemberRole({
      orgId: "org-1",
      userId: "user-1",
      memberId: "member-1",
      roleId: "role-editor",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const locale = await updateOrgLocaleSettings({
      orgId: "org-1",
      userId: "user-1",
      defaultLocale: "en-US",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(member.roleId).toBe("role-editor");
    expect(locale.defaultLocale).toBe("en-US");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
