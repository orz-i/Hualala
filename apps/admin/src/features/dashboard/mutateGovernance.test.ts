import {
  createRole,
  deleteRole,
  updateRole,
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

  it("posts role CRUD mutations through the dedicated governance routes", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            role: {
              roleId: "role-editor",
              orgId: "org-1",
              code: "editor",
              displayName: "Editor",
              permissionCodes: ["session.read", "org.roles.read"],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            role: {
              roleId: "role-editor",
              orgId: "org-1",
              code: "editor",
              displayName: "Content Editor",
              permissionCodes: ["session.read"],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const created = await createRole({
      orgId: "org-1",
      userId: "user-1",
      code: "editor",
      displayName: "Editor",
      permissionCodes: ["session.read", "org.roles.read"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const updated = await updateRole({
      orgId: "org-1",
      userId: "user-1",
      roleId: "role-editor",
      displayName: "Content Editor",
      permissionCodes: ["session.read"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    await deleteRole({
      orgId: "org-1",
      userId: "user-1",
      roleId: "role-editor",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(created.permissionCodes).toEqual(["session.read", "org.roles.read"]);
    expect(updated.displayName).toBe("Content Editor");
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
