import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdminBackupViewModel } from "./backup";
import { createTranslator } from "../../i18n";
import { downloadBackupPackageFile } from "./downloadBackupPackageFile";
import { loadBackupPanel } from "./loadBackupPanel";
import {
  applyBackupPackage,
  createBackupPackage,
  getBackupPackage,
  preflightRestoreBackupPackage,
} from "./mutateBackup";
import { useAdminBackupController } from "./useAdminBackupController";

vi.mock("./loadBackupPanel", () => ({
  loadBackupPanel: vi.fn(),
}));
vi.mock("./mutateBackup", () => ({
  createBackupPackage: vi.fn(),
  getBackupPackage: vi.fn(),
  preflightRestoreBackupPackage: vi.fn(),
  applyBackupPackage: vi.fn(),
}));
vi.mock("./downloadBackupPackageFile", () => ({
  downloadBackupPackageFile: vi.fn(),
}));
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadBackupPanelMock = vi.mocked(loadBackupPanel);
const createBackupPackageMock = vi.mocked(createBackupPackage);
const getBackupPackageMock = vi.mocked(getBackupPackage);
const preflightRestoreBackupPackageMock = vi.mocked(preflightRestoreBackupPackage);
const applyBackupPackageMock = vi.mocked(applyBackupPackage);
const downloadBackupPackageFileMock = vi.mocked(downloadBackupPackageFile);

function createBackupViewModel(): AdminBackupViewModel {
  return {
    currentSession: {
      sessionId: "dev:org-demo-001:user-demo-001",
      orgId: "org-demo-001",
      userId: "user-demo-001",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.settings.write"],
      timezone: "Asia/Shanghai",
    },
    backupPackages: [
      {
        packageId: "package-1",
        schemaVersion: "backup_v1",
        restoreMode: "full_runtime_replace",
        createdAt: "2026-03-25T10:00:00Z",
        createdByUserId: "user-demo-001",
        orgIds: ["org-demo-001"],
        projectIds: ["project-1"],
        counts: {
          workflow_runs: 1,
        },
        payloadBytes: 2048,
      },
    ],
    capabilities: {
      canManageBackup: true,
    },
  };
}

describe("useAdminBackupController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads backup packages once the session is ready", async () => {
    loadBackupPanelMock.mockResolvedValue(createBackupViewModel());

    const { result } = renderHook(() =>
      useAdminBackupController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.backup?.backupPackages[0]?.packageId).toBe("package-1");
    });
    expect(result.current.selectedPackageId).toBe("package-1");
  });

  it("creates a backup package and refreshes the list", async () => {
    let loadCount = 0;
    loadBackupPanelMock.mockImplementation(async () => {
      loadCount += 1;
      if (loadCount >= 3) {
        return {
          ...createBackupViewModel(),
          backupPackages: [
            {
              ...createBackupViewModel().backupPackages[0],
              packageId: "package-2",
            },
          ],
        };
      }
      return createBackupViewModel();
    });
    createBackupPackageMock.mockResolvedValueOnce({
      ...createBackupViewModel().backupPackages[0],
      packageId: "package-2",
    });

    const { result } = renderHook(() =>
      useAdminBackupController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.backup?.backupPackages[0]?.packageId).toBe("package-1");
    });

    act(() => {
      result.current.onCreateBackupPackage();
    });

    await waitFor(() => {
      expect(result.current.backupActionFeedback?.tone).toBe("success");
    });

    expect(createBackupPackageMock).toHaveBeenCalledWith({
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
    expect(result.current.selectedPackageId).toBe("package-2");
  });

  it("downloads package json and runs destructive restore after preflight", async () => {
    loadBackupPanelMock.mockResolvedValue(createBackupViewModel());
    getBackupPackageMock.mockResolvedValueOnce({
      backupPackage: createBackupViewModel().backupPackages[0],
      packageJson: '{"packageId":"package-1"}',
    });
    preflightRestoreBackupPackageMock.mockResolvedValueOnce({
      packageId: "package-1",
      packageSummary: {
        orgIds: ["org-demo-001"],
        projectIds: ["project-1"],
        counts: { workflow_runs: 1 },
        payloadBytes: 2048,
      },
      currentSummary: {
        orgIds: ["org-demo-001"],
        projectIds: ["project-1"],
        counts: { workflow_runs: 1 },
        payloadBytes: 2048,
      },
      warnings: ["Restore will replace current runtime state and clear transient gateway results."],
      destructive: true,
    });
    applyBackupPackageMock.mockResolvedValueOnce(createBackupViewModel().backupPackages[0]);

    const { result } = renderHook(() =>
      useAdminBackupController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedPackageId).toBe("package-1");
    });

    act(() => {
      result.current.onDownloadBackupPackage();
    });
    await waitFor(() => {
      expect(downloadBackupPackageFileMock).toHaveBeenCalledWith(
        "hualala-backup-package-1.json",
        '{"packageId":"package-1"}',
      );
    });

    act(() => {
      result.current.onPreflightRestoreBackupPackage();
    });
    await waitFor(() => {
      expect(result.current.restorePreflight?.packageId).toBe("package-1");
    });

    act(() => {
      result.current.onApplyBackupPackage();
    });
    await waitFor(() => {
      expect(result.current.backupActionFeedback?.tone).toBe("success");
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(applyBackupPackageMock).toHaveBeenCalledWith({
      orgId: "org-demo-001",
      userId: "user-demo-001",
      packageId: "package-1",
    });
  });

  it("surfaces an error when apply is attempted before preflight", async () => {
    loadBackupPanelMock.mockResolvedValue(createBackupViewModel());

    const { result } = renderHook(() =>
      useAdminBackupController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedPackageId).toBe("package-1");
    });

    act(() => {
      result.current.onApplyBackupPackage();
    });

    expect(result.current.backupActionFeedback?.tone).toBe("error");
    expect(result.current.backupActionFeedback?.message).toContain("恢复前校验");
  });
});
