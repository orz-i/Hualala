import { buildDefaultDevSession, withGovernance, withRecentChanges } from "./governance.ts";
import type {
  MockConnectScenario,
  MockConnectState,
  Phase1DemoScenarios,
} from "./types.ts";
import { buildInitialWorkflowRuns } from "./workflow.ts";

let phase1DemoScenariosPromise: Promise<Phase1DemoScenarios> | undefined;

export async function loadPhase1DemoScenarios(): Promise<Phase1DemoScenarios> {
  if (!phase1DemoScenariosPromise) {
    phase1DemoScenariosPromise = import("../../../../tooling/scripts/demo_seed.mjs").then(
      (module) => module.buildPhase1DemoScenarios() as Phase1DemoScenarios,
    );
  }

  return phase1DemoScenariosPromise;
}

export function initializeMockConnectState({
  scenario,
  phase1DemoScenarios,
}: {
  scenario: MockConnectScenario;
  phase1DemoScenarios: Phase1DemoScenarios;
}): MockConnectState {
  const adminState = withRecentChanges(
    withGovernance(clone(phase1DemoScenarios.admin[scenario.admin ?? "success"])),
  );
  const creatorShotState = clone(
    phase1DemoScenarios.creatorShot[scenario.creatorShot ?? "success"],
  );
  const creatorShotWorkflowRuns = scenario.admin
    ? buildInitialWorkflowRuns({
        projectId:
          creatorShotState.workbench.shotExecution.projectId ?? adminState.budgetSnapshot.projectId,
        resourceId: creatorShotState.workbench.shotExecution.id,
      })
    : [];
  const creatorImportState = clone(
    phase1DemoScenarios.creatorImport[scenario.creatorImport ?? "success"],
  );

  return {
    devSessionActive: false,
    adminState,
    creatorShotState,
    creatorShotWorkflowRuns,
    creatorImportState,
  };
}

export function buildFallbackSession() {
  return buildDefaultDevSession();
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
