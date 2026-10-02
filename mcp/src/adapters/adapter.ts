import type {
  AgentRunInput,
  ApprovalRequest,
  ApprovalRequestInput,
  ArtistContext,
  CreateTaskInput,
  OperatingSnapshot,
  TaskRecord,
  UpdateTaskInput,
  WorkflowDefinition,
  WorkflowRun,
  StartWorkflowInput,
  AdvanceWorkflowInput,
} from "../domain.js";

export interface MusicOsAdapter {
  getArtistContext(artistId: string): Promise<ArtistContext>;
  getOperatingSnapshot(artistId: string): Promise<OperatingSnapshot>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(input: UpdateTaskInput): Promise<TaskRecord>;
  requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest>;
  logAgentRun(input: AgentRunInput): Promise<{ runId: string; url?: string }>;
  getWorkflow(workflowId: string): Promise<WorkflowDefinition>;
  listWorkflows(): Promise<WorkflowDefinition[]>;
  startWorkflow(input: StartWorkflowInput): Promise<WorkflowRun>;
  getWorkflowRun(runId: string): Promise<WorkflowRun>;
  advanceWorkflow(input: AdvanceWorkflowInput): Promise<WorkflowRun>;
}
