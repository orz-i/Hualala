export type AdminMode = "success" | "failure";
export type CreatorShotMode = "success" | "failure";
export type CreatorImportMode = "success" | "failure";
export type PreviewMode = "success" | "failure";
export type AudioMode = "success" | "failure";
export type ReuseMode = "success";
export type CollaborationMode = "success";

export type MockConnectScenario = {
  admin?: AdminMode;
  creatorShot?: CreatorShotMode;
  creatorImport?: CreatorImportMode;
  preview?: PreviewMode;
  audio?: AudioMode;
  reuse?: ReuseMode;
  collaboration?: CollaborationMode;
};

export type MockSession = {
  sessionId: string;
  orgId: string;
  userId: string;
  locale: string;
  roleId: string;
  roleCode: string;
  permissionCodes: string[];
  timezone: string;
};

export type GovernancePermission = {
  code: string;
  displayName: string;
  group: string;
};

export type GovernanceRole = {
  roleId: string;
  orgId: string;
  code: string;
  displayName: string;
  permissionCodes: string[];
  memberCount: number;
};

export type GovernanceMember = {
  memberId: string;
  orgId: string;
  userId: string;
  roleId: string;
};

export type GovernanceState = {
  currentSession: MockSession;
  userPreferences: {
    userId: string;
    displayLocale: string;
    timezone: string;
  };
  members: GovernanceMember[];
  roles: GovernanceRole[];
  availablePermissions: GovernancePermission[];
  orgLocaleSettings: {
    orgId: string;
    defaultLocale: string;
    supportedLocales: string[];
  };
  capabilities: {
    canManageRoles: boolean;
    canManageMembers: boolean;
    canManageOrgSettings: boolean;
    canManageUserPreferences: boolean;
  };
};

export type AdminState = {
  budgetSnapshot: {
    projectId: string;
    limitCents: number;
    reservedCents: number;
    remainingBudgetCents: number;
  };
  updatedBudgetSnapshot?: {
    projectId: string;
    limitCents: number;
    reservedCents: number;
    remainingBudgetCents: number;
  };
  usageRecords: Array<{ id: string; meter: string; amountCents: number }>;
  billingEvents: Array<{ id: string; eventType: string; amountCents: number }>;
  reviewSummary: { shotExecutionId: string; latestConclusion: string };
  evaluationRuns: Array<{ id: string; status: string; failedChecks: string[] }>;
  shotReviews: Array<{ id: string; conclusion: string }>;
  governance: GovernanceState;
};

export type AdminScenarioState = Omit<AdminState, "governance"> &
  Partial<Pick<AdminState, "governance">>;

export type RecentChange = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  tone: string;
};

export type AdminStateWithRecentChanges = AdminState & {
  recentChanges: RecentChange[];
};

export type CreatorShotState = {
  workbench: {
    shotExecution: {
      id: string;
      shotId: string;
      orgId?: string;
      projectId?: string;
      status: string;
      primaryAssetId: string;
    };
    candidateAssets: Array<{ id: string; assetId: string }>;
    reviewSummary: { latestConclusion: string };
    latestEvaluationRun?: { id: string; status: string };
  };
  afterGate?: {
    workbench: CreatorShotState["workbench"];
    gateResult: {
      passedChecks: string[];
      failedChecks: string[];
    };
  };
  afterSubmit?: {
    workbench: CreatorShotState["workbench"];
  };
};

export type CreatorImportState = {
  importBatch: {
    id: string;
    status: string;
    sourceType: string;
  };
  uploadSessions: Array<{ id: string; status: string }>;
  items: Array<{ id: string; status: string; assetId: string }>;
  candidateAssets: Array<{ id: string; assetId: string }>;
  shotExecutions: Array<{ id: string; status: string; primaryAssetId: string }>;
  afterConfirm?: Omit<CreatorImportState, "afterConfirm" | "afterSelect">;
  afterSelect?: Omit<CreatorImportState, "afterConfirm" | "afterSelect">;
};

export type MockTimestamp = {
  seconds: string;
  nanos: number;
};

export type MockWorkflowStep = {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: MockTimestamp;
  completedAt?: MockTimestamp;
  failedAt?: MockTimestamp;
};

export type MockWorkflowRun = {
  id: string;
  workflowType: string;
  status: string;
  resourceId: string;
  projectId: string;
  provider: string;
  currentStep: string;
  attemptCount: number;
  lastError: string;
  externalRequestId: string;
  createdAt: MockTimestamp;
  updatedAt: MockTimestamp;
  steps: MockWorkflowStep[];
};

export type Phase1DemoScenarios = {
  admin: Record<AdminMode, AdminScenarioState>;
  creatorShot: Record<CreatorShotMode, CreatorShotState>;
  creatorImport: Record<CreatorImportMode, CreatorImportState>;
};

export type MockConnectState = {
  devSessionActive: boolean;
  adminState: AdminStateWithRecentChanges;
  creatorShotState: CreatorShotState;
  creatorShotWorkflowRuns: MockWorkflowRun[];
  creatorImportState: CreatorImportState;
};

export type PreviewAssemblyItemState = {
  itemId: string;
  assemblyId: string;
  shotId: string;
  primaryAssetId: string;
  sourceRunId: string;
  sequence: number;
};

export type PreviewAssemblyState = {
  assemblyId: string;
  projectId: string;
  episodeId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: PreviewAssemblyItemState[];
};

export type PreviewRuntimeState = {
  previewRuntimeId: string;
  projectId: string;
  episodeId: string;
  assemblyId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  playbackAssetId: string;
  exportAssetId: string;
  resolvedLocale: string;
  createdAt: string;
  updatedAt: string;
  playback: {
    deliveryMode: string;
    playbackUrl: string;
    posterUrl: string;
    durationMs: number;
    timeline: {
      totalDurationMs: number;
      segments: Array<{
        segmentId: string;
        sequence: number;
        shotId: string;
        shotCode: string;
        shotTitle: string;
        playbackAssetId: string;
        sourceRunId: string;
        startMs: number;
        durationMs: number;
        transitionToNext: {
          transitionType: string;
          durationMs: number;
        } | null;
      }>;
    } | null;
  } | null;
  exportOutput: {
    downloadUrl: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  } | null;
  lastErrorCode: string;
  lastErrorMessage: string;
};

export type AudioClipState = {
  clipId: string;
  trackId: string;
  assetId: string;
  sourceRunId: string;
  sequence: number;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
};

export type AudioTrackState = {
  trackId: string;
  timelineId: string;
  trackType: string;
  displayName: string;
  sequence: number;
  muted: boolean;
  solo: boolean;
  volumePercent: number;
  clips: AudioClipState[];
};

export type AudioTimelineState = {
  audioTimelineId: string;
  projectId: string;
  episodeId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  createdAt: string;
  updatedAt: string;
  tracks: AudioTrackState[];
};

export type AudioRuntimeState = {
  audioRuntimeId: string;
  projectId: string;
  episodeId: string;
  audioTimelineId: string;
  status: string;
  renderWorkflowRunId: string;
  renderStatus: string;
  mixAssetId: string;
  mixOutput: {
    deliveryMode: string;
    playbackUrl: string;
    downloadUrl: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
    durationMs: number;
  } | null;
  waveforms: Array<{
    assetId: string;
    variantId: string;
    waveformUrl: string;
    mimeType: string;
    durationMs: number;
  }>;
  lastErrorCode: string;
  lastErrorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type CollaborationPresenceState = {
  presenceId: string;
  sessionId: string;
  userId: string;
  status: string;
  lastSeenAt: string;
  leaseExpiresAt: string;
};

export type CollaborationSessionState = {
  sessionId: string;
  ownerType: "project" | "shot";
  ownerId: string;
  draftVersion: number;
  lockHolderUserId: string;
  leaseExpiresAt: string;
  conflictSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type CollaborationState = {
  projectId: string;
  session: CollaborationSessionState;
  presences: CollaborationPresenceState[];
};
