import { ShotWorkbenchPage, type ShotWorkbenchViewModel } from "../features/shot-workbench/ShotWorkbenchPage";

const demoWorkbench: ShotWorkbenchViewModel = {
  shotExecution: {
    id: "shot-exec-demo-001",
    shotId: "shot-demo-001",
    status: "submitted_for_review",
    primaryAssetId: "asset-demo-001",
  },
  candidateAssets: [
    { id: "candidate-demo-001", assetId: "asset-demo-001" },
    { id: "candidate-demo-002", assetId: "asset-demo-002" },
  ],
  reviewSummary: {
    latestConclusion: "approved",
  },
  latestEvaluationRun: {
    id: "eval-demo-001",
    status: "passed",
  },
};

export function App() {
  return <ShotWorkbenchPage workbench={demoWorkbench} />;
}
