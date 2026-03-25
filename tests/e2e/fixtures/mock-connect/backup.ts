type BackupFixtureSummary = {
  orgIds: string[];
  projectIds: string[];
  counts: Record<string, number>;
  payloadBytes: number;
};

type BackupFixturePackage = {
  packageId: string;
  schemaVersion: string;
  restoreMode: string;
  createdAt: string;
  createdByUserId: string;
  summary: BackupFixtureSummary;
  packageJson: string;
};

export type BackupFixtureState = {
  currentSummary: BackupFixtureSummary;
  packages: BackupFixturePackage[];
  nextSequence: number;
};

const backupSchemaVersion = "backup_v1";
const backupRestoreMode = "full_runtime_replace";

export function createBackupState({
  orgId,
  userId,
  projectId,
}: {
  orgId: string;
  userId: string;
  projectId: string;
}): BackupFixtureState {
  const currentSummary = buildBackupSummary({
    orgId,
    projectId,
    payloadBytes: 5_120,
  });
  return {
    currentSummary,
    packages: [],
    nextSequence: 1,
  };
}

export function createBackupPackageState(
  state: BackupFixtureState,
  {
    orgId,
    userId,
    projectId,
  }: {
    orgId: string;
    userId: string;
    projectId: string;
  },
) {
  const packageId = `pkg-backup-${String(state.nextSequence).padStart(3, "0")}`;
  const createdAt = new Date(Date.UTC(2026, 2, 25, 9, state.nextSequence, 0)).toISOString();
  const summary = buildBackupSummary({
    orgId,
    projectId,
    payloadBytes: 5_120 + state.nextSequence * 256,
  });
  const record: BackupFixturePackage = {
    packageId,
    schemaVersion: backupSchemaVersion,
    restoreMode: backupRestoreMode,
    createdAt,
    createdByUserId: userId,
    summary,
    packageJson: JSON.stringify(
      {
        metadata: {
          packageId,
          schemaVersion: backupSchemaVersion,
          restoreMode: backupRestoreMode,
          createdAt,
          createdByUserId: userId,
          orgIds: summary.orgIds,
          projectIds: summary.projectIds,
          counts: summary.counts,
          payloadBytes: summary.payloadBytes,
        },
        snapshot: {
          projects: summary.projectIds.map((id) => ({ id })),
          workflowRuns: [{ id: "workflow-run-1", projectId }],
          workflowSteps: [{ id: "workflow-step-1", workflowRunId: "workflow-run-1" }],
          jobs: [{ id: "job-1", resourceType: "workflow_run", resourceId: "workflow-run-1" }],
          stateTransitions: [
            { id: "transition-1", resourceType: "workflow_run", resourceId: "workflow-run-1" },
          ],
          gatewayResults: [],
        },
      },
      null,
      2,
    ),
  };

  return {
    state: {
      ...state,
      packages: [record, ...state.packages],
      nextSequence: state.nextSequence + 1,
    },
    record,
  };
}

export function buildBackupPackagePayload(record: BackupFixturePackage) {
  return {
    packageId: record.packageId,
    schemaVersion: record.schemaVersion,
    restoreMode: record.restoreMode,
    createdAt: record.createdAt,
    createdByUserId: record.createdByUserId,
    summary: buildBackupSummaryPayload(record.summary),
  };
}

export function buildListBackupPackagesPayload(state: BackupFixtureState) {
  return {
    backupPackages: state.packages.map((record) => buildBackupPackagePayload(record)),
  };
}

export function buildGetBackupPackagePayload(record: BackupFixturePackage) {
  return {
    backupPackage: buildBackupPackagePayload(record),
    packageJson: record.packageJson,
  };
}

export function buildPreflightRestorePayload(
  state: BackupFixtureState,
  record: BackupFixturePackage,
) {
  return {
    packageSummary: buildBackupSummaryPayload(record.summary),
    currentSummary: buildBackupSummaryPayload(state.currentSummary),
    warnings: ["恢复会覆盖当前运行时数据。", "transient gateway_results 缓存会被清空。"],
    destructive: true,
  };
}

export function applyBackupPackageState(
  state: BackupFixtureState,
  record: BackupFixturePackage,
): BackupFixtureState {
  return {
    ...state,
    currentSummary: clone(record.summary),
  };
}

export function findBackupPackage(state: BackupFixtureState, packageId: string) {
  return state.packages.find((record) => record.packageId === packageId) ?? null;
}

function buildBackupSummary({
  orgId,
  projectId,
  payloadBytes,
}: {
  orgId: string;
  projectId: string;
  payloadBytes: number;
}): BackupFixtureSummary {
  return {
    orgIds: [orgId],
    projectIds: [projectId],
    counts: {
      projects: 1,
      workflow_runs: 1,
      workflow_steps: 1,
      jobs: 1,
      state_transitions: 1,
    },
    payloadBytes,
  };
}

function buildBackupSummaryPayload(summary: BackupFixtureSummary) {
  return {
    orgIds: [...summary.orgIds],
    projectIds: [...summary.projectIds],
    counts: { ...summary.counts },
    payloadBytes: summary.payloadBytes,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
