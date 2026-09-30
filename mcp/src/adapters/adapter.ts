import type {
  AgentRunInput,
  ApprovalRequest,
  ApprovalRequestInput,
  ArtistContext,
  CreateTaskInput,
  OperatingSnapshot,
  TaskRecord,
  UpdateTaskInput,
} from "../domain.js";

export interface MusicOsAdapter {
  getArtistContext(artistId: string): Promise<ArtistContext>;
  getOperatingSnapshot(artistId: string): Promise<OperatingSnapshot>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(input: UpdateTaskInput): Promise<TaskRecord>;
  requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest>;
  logAgentRun(input: AgentRunInput): Promise<{ runId: string; url?: string }>;
}
