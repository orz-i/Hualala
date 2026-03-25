import { loadBackupPanel } from "./loadBackupPanel";

describe("loadBackupPanel", () => {
  it("loads current session and backup packages into one view model", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.auth.v1.AuthService/GetCurrentSession")) {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: "dev:org-live-1:user-live-1",
              orgId: "org-live-1",
              userId: "user-live-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: ["session.read", "org.settings.write"],
              timezone: "Asia/Shanghai",
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          backupPackages: [
            {
              packageId: "package-1",
              schemaVersion: "backup_v1",
              restoreMode: "full_runtime_replace",
              createdAt: "2026-03-25T10:00:00Z",
              createdByUserId: "user-live-1",
              summary: {
                orgIds: ["org-live-1"],
                projectIds: ["project-1"],
                counts: {
                  workflow_runs: 1,
                  jobs: 2,
                },
                payloadBytes: 2048,
              },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await loadBackupPanel({
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.currentSession.sessionId).toBe("dev:org-live-1:user-live-1");
    expect(result.currentSession.permissionCodes).toContain("org.settings.write");
    expect(result.capabilities.canManageBackup).toBe(true);
    expect(result.capabilities.isRuntimeAvailable).toBe(true);
    expect(result.capabilities.unavailableReason).toBe("");
    expect(result.backupPackages).toHaveLength(1);
    expect(result.backupPackages[0]?.packageId).toBe("package-1");
    expect(result.backupPackages[0]?.counts.workflow_runs).toBe(1);
    expect(result.backupPackages[0]?.payloadBytes).toBe(2048);
  });

  it("degrades to an unavailable backup view when the backend reports failed_precondition", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.auth.v1.AuthService/GetCurrentSession")) {
        return new Response(
          JSON.stringify({
            session: {
              sessionId: "dev:org-live-1:user-live-1",
              orgId: "org-live-1",
              userId: "user-live-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: ["session.read", "org.settings.write"],
              timezone: "Asia/Shanghai",
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          code: "failed_precondition",
          message: "db: failed precondition: backup restore requires postgres runtime",
        }),
        { status: 412 },
      );
    });

    const result = await loadBackupPanel({
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.currentSession.sessionId).toBe("dev:org-live-1:user-live-1");
    expect(result.capabilities.canManageBackup).toBe(true);
    expect(result.capabilities.isRuntimeAvailable).toBe(false);
    expect(result.capabilities.unavailableReason).toContain("postgres runtime");
    expect(result.backupPackages).toEqual([]);
  });
});
