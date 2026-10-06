export type RuntimeMode = "PAUSED" | "SUPERVISED" | "ACTIVE";
export type ExternalActionsMode = "BLOCKED" | "APPROVAL_ONLY" | "ALLOWED";
export type ApprovalState = "Not Required" | "Pending" | "Approved" | "Rejected";
export type TaskStatus = "Not Started" | "In Progress" | "Waiting" | "Done";
export type TaskPriority = "Critical" | "High" | "Medium" | "Low";

export interface ArtistContext {
  artistId: string;
  artistName?: string;
  stage?: string;
  twelveMonthObjective?: string;
  ninetyDayGoal?: string;
  weeklyTop3: string[];
  currentBottleneck?: string;
  nextImportantDate?: string;
  source: string;
  rawText?: string;
}

export interface RuntimeControl {
  mode: RuntimeMode;
  externalActions: ExternalActionsMode;
}

export interface ProjectRecord {
  id: string;
  name: string;
  status?: string;
  area?: string;
  priority?: string;
  deadline?: string;
  goal?: string;
  url?: string;
}

export interface TaskRecord {
  id: string;
  task: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  nextAction?: string;
  sourceAgent?: string;
  approvalState?: ApprovalState;
  agentRunId?: string;
  projectId?: string;
  url?: string;
}

export interface OperatingSnapshot {
  artist: ArtistContext;
  activeProjects: ProjectRecord[];
  openTasks: TaskRecord[];
  runtime: RuntimeControl;
}

export interface CreateTaskInput {
  artistId: string;
  task: string;
  nextAction: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  sourceAgent: string;
  projectId?: string;
  approvalState?: ApprovalState;
  agentRunId?: string;
}

export interface UpdateTaskInput {
  artistId: string;
  taskId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  nextAction?: string;
  approvalState?: ApprovalState;
  agentRunId?: string;
}

export interface ApprovalRequestInput {
  artistId: string;
  actionType: string;
  summary: string;
  relatedObject?: string;
  sourceAgent: string;
  actionFingerprint: string;
}

export interface ApprovalRequest {
  approvalId: string;
  state: "Pending";
  actionFingerprint: string;
}

export interface AgentRunInput {
  artistId: string;
  runId: string;
  sourceAgent: string;
  trigger: string;
  state: "Started" | "Waiting Approval" | "Succeeded" | "Failed" | "Retryable" | "Aborted";
  approvalState?: ApprovalState;
  actionFingerprint?: string;
  relatedObject?: string;
  notes?: string;
}


export type WorkflowState =
  | "NOT_STARTED"
  | "CONTEXT_CHECK"
  | "READY"
  | "RUNNING"
  | "WAITING_FOR_DATA"
  | "WAITING_FOR_APPROVAL"
  | "EXECUTING"
  | "MEASURING"
  | "COMPLETED"
  | "BLOCKED";

export interface WorkflowDefinition {
  workflowId: string;
  version: string;
  name: string;
  purpose?: string;
  ownerAgent?: string;
  trigger?: string;
  requiredContext?: string;
  preconditions?: string;
  steps?: string;
  decisionRules?: string;
  approvalGates?: string;
  writeBack?: string;
  kpis?: string;
  definitionOfDone?: string;
  nextWorkflows: string[];
  active: boolean;
  url?: string;
}

export interface WorkflowRun {
  runId: string;
  artistId: string;
  workflowId: string;
  workflowVersion: string;
  relatedObject?: string;
  state: WorkflowState;
  currentStep?: string;
  trigger: string;
  contextSnapshot?: string;
  approvalState: ApprovalState;
  blockedReason?: string;
  nextAction?: string;
  result?: string;
  startedAt: string;
  updatedAt: string;
  url?: string;
}

export interface StartWorkflowInput {
  artistId: string;
  workflowId: string;
  trigger: string;
  relatedObject?: string;
  contextSnapshot?: string;
}

export interface AdvanceWorkflowInput {
  artistId: string;
  runId: string;
  state?: WorkflowState;
  currentStep?: string;
  approvalState?: ApprovalState;
  blockedReason?: string;
  nextAction?: string;
  result?: string;
}
