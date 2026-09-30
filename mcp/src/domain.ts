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
