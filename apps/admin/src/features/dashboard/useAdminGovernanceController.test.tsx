import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdminGovernanceViewModel } from "./governance";
import { createTranslator } from "../../i18n";
import { loadGovernancePanel } from "./loadGovernancePanel";
import { updateUserPreferences } from "./mutateGovernance";
import { useAdminGovernanceController } from "./useAdminGovernanceController";

vi.mock("./loadGovernancePanel", () => ({
  loadGovernancePanel: vi.fn(),
}));
vi.mock("./mutateGovernance", async () => {
  const actual = await vi.importActual<typeof import("./mutateGovernance")>("./mutateGovernance");
  return {
    ...actual,
    updateUserPreferences: vi.fn(),
    updateMemberRole: vi.fn(),
    updateOrgLocaleSettings: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
  };
});
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadGovernancePanelMock = vi.mocked(loadGovernancePanel);
const updateUserPreferencesMock = vi.mocked(updateUserPreferences);

function createGovernance(orgId: string, userId: string): AdminGovernanceViewModel {
  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId,
      displayLocale: "zh-CN",
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [
      {
        roleId: "role-admin",
        orgId,
        code: "admin",
        displayName: "Administrator",
        permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
        memberCount: 1,
      },
    ],
    availablePermissions: [
      {
        code: "org.roles.write",
        displayName: "Manage roles",
        group: "governance",
      },
    ],
    orgLocaleSettings: {
      orgId,
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
    },
    capabilities: {
      canManageRoles: true,
      canManageMembers: true,
      canManageOrgSettings: true,
      canManageUserPreferences: true,
    },
  };
}

describe("useAdminGovernanceController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads governance once the session is ready", async () => {
    loadGovernancePanelMock.mockResolvedValueOnce(createGovernance("org-demo-001", "user-demo-001"));

    const { result } = renderHook(() =>
      useAdminGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.governance?.currentSession.orgId).toBe("org-demo-001");
    });
  });

  it("refreshes governance after a successful governance action", async () => {
    loadGovernancePanelMock
      .mockResolvedValueOnce(createGovernance("org-demo-001", "user-demo-001"))
      .mockResolvedValueOnce({
        ...createGovernance("org-demo-001", "user-demo-001"),
        userPreferences: {
          userId: "user-demo-001",
          displayLocale: "en-US",
          timezone: "UTC",
        },
      });
    updateUserPreferencesMock.mockResolvedValueOnce({
      userId: "user-demo-001",
      displayLocale: "en-US",
      timezone: "UTC",
    });

    const { result } = renderHook(() =>
      useAdminGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.governance?.userPreferences.displayLocale).toBe("zh-CN");
    });

    act(() => {
      result.current.onUpdateUserPreferences({
        userId: "user-demo-001",
        displayLocale: "en-US",
        timezone: "UTC",
      });
    });

    await waitFor(() => {
      expect(result.current.governanceActionFeedback?.tone).toBe("success");
    });

    expect(updateUserPreferencesMock).toHaveBeenCalledWith({
      orgId: "org-demo-001",
      userId: "user-demo-001",
      displayLocale: "en-US",
      timezone: "UTC",
    });
    expect(loadGovernancePanelMock).toHaveBeenCalledTimes(2);
    expect(result.current.governance?.userPreferences.displayLocale).toBe("en-US");
  });

  it("keeps governance data visible and surfaces an error when governance actions fail", async () => {
    const governance = createGovernance("org-demo-001", "user-demo-001");
    loadGovernancePanelMock.mockResolvedValueOnce(governance);
    updateUserPreferencesMock.mockRejectedValueOnce(new Error("governance exploded"));

    const { result } = renderHook(() =>
      useAdminGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.governance?.currentSession.orgId).toBe("org-demo-001");
    });

    act(() => {
      result.current.onUpdateUserPreferences({
        userId: "user-demo-001",
        displayLocale: "en-US",
        timezone: "UTC",
      });
    });

    await waitFor(() => {
      expect(result.current.governanceActionFeedback?.tone).toBe("error");
    });

    expect(result.current.governance).toEqual(governance);
    expect(result.current.governanceActionFeedback?.message).toContain("governance exploded");
  });

  it("does not load governance when the route is not active", async () => {
    const { result } = renderHook(() =>
      useAdminGovernanceController({
        sessionState: "ready",
        enabled: false,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.governance).toBeNull();
    });

    expect(loadGovernancePanelMock).not.toHaveBeenCalled();
  });
});
