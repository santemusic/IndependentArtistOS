import type {
  AgentRunInput,
  ApprovalRequest,
  ApprovalRequestInput,
  ArtistContext,
  OperatingSnapshot,
  TaskRecord,
  UpdateTaskInput,
  CreateTaskInput,
} from "../domain.js";
import { getRuntimeControl } from "../governance.js";

export interface SupabaseConnection {
  connectionToken: string;
  userId: string;
  workspaceId: string;
  role?: string;
  connectionExpiresAt?: string;
}

export interface RecentChanges {
  current_version: number;
  events: Array<Record<string, unknown>>;
  has_more: boolean;
}

const statusFromDb = (value?: string | null): TaskRecord["status"] => {
  if (value === "IN_PROGRESS") return "In Progress";
  if (value === "WAITING") return "Waiting";
  if (value === "DONE") return "Done";
  return "Not Started";
};

const statusToDb = (value?: TaskRecord["status"]): string | undefined => {
  if (!value) return undefined;
  if (value === "In Progress") return "IN_PROGRESS";
  if (value === "Waiting") return "WAITING";
  if (value === "Done") return "DONE";
  return "NEXT";
};

const priorityFromDb = (value?: string | null): TaskRecord["priority"] => {
  if (value === "HIGH") return "High";
  if (value === "LOW") return "Low";
  return "Medium";
};

const priorityToDb = (value?: TaskRecord["priority"]): string | undefined => {
  if (!value) return undefined;
  if (value === "High" || value === "Critical") return "HIGH";
  if (value === "Low") return "LOW";
  return "MEDIUM";
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value.replace(/\/$/, "");
}

export class SupabaseAdapter {
  private readonly baseUrl = requiredEnv("SUPABASE_URL");

  constructor(private readonly connection: SupabaseConnection) {}

  get workspaceId(): string {
    return this.connection.workspaceId;
  }

  get userId(): string {
    return this.connection.userId;
  }

  get role(): string | undefined {
    return this.connection.role;
  }

  private async gateway<T>(operation: string, input: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/functions/v1/mcp-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        connection_token: this.connection.connectionToken,
        operation,
        input,
      }),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error || `MCP gateway request failed (${response.status})`;
      throw new Error(message);
    }
    return body.result as T;
  }

  private async directRead<T>(operation: string, input: Record<string, unknown> = {}): Promise<T> {
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) throw new Error("Missing required environment variable: SUPABASE_ANON_KEY");
    const response = await fetch(`${this.baseUrl}/rest/v1/rpc/mcp_direct_read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        _connection_token: this.connection.connectionToken,
        _operation: operation,
        _input: input,
      }),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || `Direct MCP read failed (${response.status})`);
    if (body?.error) throw new Error(body.error);
    return body?.result as T;
  }

  private ensureWorkspace(artistId?: string): string {
    if (artistId && artistId !== this.workspaceId) {
      throw new Error("Requested artist/workspace does not match the authenticated connection.");
    }
    return this.workspaceId;
  }

  async getArtistContext(artistId = this.workspaceId): Promise<ArtistContext> {
    this.ensureWorkspace(artistId);
    const context: any = await this.gateway<any>("get_artist_context");
    if (context?.nextImportantDate && typeof context.nextImportantDate === "object") {
      const date = context.nextImportantDate.date ?? "";
      const label = context.nextImportantDate.label ?? "";
      context.nextImportantDate = [date, label].filter(Boolean).join(" — ");
    }
    return context as ArtistContext;
  }

  async listTasks(artistId = this.workspaceId, includeDone = false): Promise<TaskRecord[]> {
    this.ensureWorkspace(artistId);
    const result = await this.gateway<{ tasks: any[] }>("list_tasks", { include_done: includeDone });
    return (result.tasks ?? []).map((row) => ({
      id: row.id,
      task: row.title ?? "Untitled task",
      status: statusFromDb(row.status),
      priority: priorityFromDb(row.priority),
      dueDate: row.due_date ?? undefined,
      nextAction: row.next_action ?? undefined,
      sourceAgent: row.source_agent ?? undefined,
      agentRunId: row.agent_run_id ?? undefined,
      projectId: row.project_id ?? undefined,
    }));
  }

  async getOperatingSnapshot(artistId = this.workspaceId): Promise<OperatingSnapshot> {
    this.ensureWorkspace(artistId);
    const result = await this.gateway<any>("get_operating_snapshot");
    const artist: any = result.artist ?? {};
    if (artist?.nextImportantDate && typeof artist.nextImportantDate === "object") {
      const date = artist.nextImportantDate.date ?? "";
      const label = artist.nextImportantDate.label ?? "";
      artist.nextImportantDate = [date, label].filter(Boolean).join(" — ");
    }
    const activeProjects = (result.activeProjects ?? []).map((row: any) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      status: row.status ?? undefined,
      deadline: row.due_date ?? undefined,
      goal: row.description ?? undefined,
    }));
    const openTasks = (result.openTasks ?? []).map((row: any) => ({
      id: row.id,
      task: row.title ?? "Untitled task",
      status: statusFromDb(row.status),
      priority: priorityFromDb(row.priority),
      dueDate: row.due_date ?? undefined,
      nextAction: row.next_action ?? undefined,
      sourceAgent: row.source_agent ?? undefined,
      agentRunId: row.agent_run_id ?? undefined,
      projectId: row.project_id ?? undefined,
    }));
    return { artist, activeProjects, openTasks, runtime: getRuntimeControl() };
  }

  async getRecentChanges(afterVersion = 0, limit = 50): Promise<RecentChanges> {
    return await this.gateway<RecentChanges>("get_recent_changes", {
      after_version: Math.max(0, Math.floor(afterVersion)),
      limit: Math.min(Math.max(1, Math.floor(limit)), 200),
    });
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    this.ensureWorkspace(input.artistId);
    const row: any = await this.gateway("create_task", {
      title: input.task,
      next_action: input.nextAction,
      priority: priorityToDb(input.priority) ?? "MEDIUM",
      due_date: input.dueDate ?? null,
      source_agent: input.sourceAgent || "chatgpt",
      project_id: input.projectId ?? null,
      agent_run_id: input.agentRunId ?? null,
    });
    return {
      id: row.id,
      task: row.title,
      status: statusFromDb(row.status),
      priority: priorityFromDb(row.priority),
      dueDate: row.due_date ?? undefined,
      nextAction: row.next_action ?? undefined,
      sourceAgent: row.source_agent ?? undefined,
      agentRunId: row.agent_run_id ?? undefined,
      projectId: row.project_id ?? undefined,
    };
  }

  async updateTask(input: UpdateTaskInput): Promise<TaskRecord> {
    this.ensureWorkspace(input.artistId);
    const payload: Record<string, unknown> = { task_id: input.taskId };
    if (input.status) payload.status = statusToDb(input.status);
    if (input.priority) payload.priority = priorityToDb(input.priority);
    if (input.dueDate !== undefined) payload.due_date = input.dueDate;
    if (input.nextAction !== undefined) payload.next_action = input.nextAction;
    if (input.agentRunId !== undefined) payload.agent_run_id = input.agentRunId;
    const row: any = await this.gateway("update_task", payload);
    return {
      id: row.id,
      task: row.title,
      status: statusFromDb(row.status),
      priority: priorityFromDb(row.priority),
      dueDate: row.due_date ?? undefined,
      nextAction: row.next_action ?? undefined,
      sourceAgent: row.source_agent ?? undefined,
      agentRunId: row.agent_run_id ?? undefined,
      projectId: row.project_id ?? undefined,
    };
  }

  async requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    this.ensureWorkspace(input.artistId);
    const row: any = await this.gateway("request_approval", {
      title: input.actionType,
      description: input.summary,
      requested_by: input.sourceAgent,
      action_fingerprint: input.actionFingerprint,
      related_object: input.relatedObject ?? null,
    });
    return {
      approvalId: row.id,
      state: "Pending",
      actionFingerprint: input.actionFingerprint,
    };
  }

  async logAgentRun(input: AgentRunInput): Promise<{ runId: string }> {
    this.ensureWorkspace(input.artistId);
    const status =
      input.state === "Started" ? "running" :
      input.state === "Succeeded" ? "succeeded" :
      input.state === "Failed" ? "failed" :
      input.state === "Aborted" ? "cancelled" :
      "queued";
    const row: any = await this.gateway("log_agent_run", {
      automation_key: input.sourceAgent || "chatgpt",
      status,
      input: {
        run_id: input.runId,
        trigger: input.trigger,
        approval_state: input.approvalState ?? null,
        action_fingerprint: input.actionFingerprint ?? null,
        related_object: input.relatedObject ?? null,
      },
      output: input.notes ? { notes: input.notes } : {},
      error: input.state === "Failed" ? input.notes ?? "Agent run failed." : null,
    });
    return { runId: String(row?.automation_key ?? input.runId) };
  }

  async searchContacts(query = "", limit = 25): Promise<any[]> {
    const result = await this.gateway<{ contacts: any[] }>("search_contacts", { query, limit });
    return result.contacts ?? [];
  }

  async getContact(contactId: string): Promise<Record<string, unknown>> {
    return await this.gateway<Record<string, unknown>>("get_contact", { contact_id: contactId });
  }

  async createContact(payload: Record<string, unknown>): Promise<any> {
    return await this.gateway("create_contact", payload);
  }

  async updateContact(contactId: string, payload: Record<string, unknown>): Promise<any> {
    return await this.gateway("update_contact", { contact_id: contactId, ...payload });
  }

  async logInteraction(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return await this.gateway("log_interaction", payload);
  }

  async searchOpportunities(query = "", status = "open", limit = 25): Promise<any[]> {
    const result = await this.gateway<{ opportunities: any[] }>("search_opportunities", {
      query,
      status,
      limit,
    });
    return result.opportunities ?? [];
  }

  async createOpportunity(payload: Record<string, unknown>): Promise<any> {
    return await this.gateway("create_opportunity", payload);
  }

  async updateWeeklyPriorities(priorities: string[]): Promise<ArtistContext> {
    return await this.gateway<ArtistContext>("update_weekly_priorities", { priorities });
  }

  async getDiscoveryStatus(): Promise<Record<string, unknown>> {
    return await this.gateway<Record<string, unknown>>("get_discovery_status");
  }

  async introspectConnection(): Promise<Record<string, unknown>> {
    return await this.gateway<Record<string, unknown>>("introspect_connection");
  }

  async revokeConnection(): Promise<{ revoked: boolean }> {
    return await this.gateway<{ revoked: boolean }>("revoke_connection");
  }

  async getSecondBrainContext(): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_second_brain_context");
  }

  async getSystemHealth(): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_system_health");
  }

  async getPositioningSummary(): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_positioning_summary");
  }

  async getResearchStatus(): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_research_status");
  }

  async getResearchFindings(domain?: string): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_research_findings", domain ? { domain } : {});
  }

  async getOnboardingPrefillSummary(): Promise<Record<string, unknown>> {
    return await this.directRead<Record<string, unknown>>("get_onboarding_prefill_summary");
  }

  async listAiAgents(): Promise<any[]> {
    return await this.directRead<any[]>("list_ai_agents");
  }

  async listWorkflows(): Promise<any[]> {
    return await this.directRead<any[]>("list_workflows");
  }
}
