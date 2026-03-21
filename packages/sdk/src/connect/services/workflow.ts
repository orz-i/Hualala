import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  CancelWorkflowRunResponse,
  GetWorkflowRunResponse,
  ListWorkflowRunsResponse,
  RetryWorkflowRunResponse,
  StartWorkflowResponse,
} from "../../gen/hualala/workflow/v1/workflow_pb";

export function createWorkflowClient(options: HualalaClientOptions = {}) {
  return createHualalaClient(options).workflow;
}

export type WorkflowClient = ReturnType<typeof createWorkflowClient>;

export type WorkflowUnaryResponses = {
  startWorkflow: StartWorkflowResponse;
  getWorkflowRun: GetWorkflowRunResponse;
  listWorkflowRuns: ListWorkflowRunsResponse;
  cancelWorkflowRun: CancelWorkflowRunResponse;
  retryWorkflowRun: RetryWorkflowRunResponse;
};
