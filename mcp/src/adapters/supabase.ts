import type {
  AgentRunInput,
  ApprovalRequest,
  ApprovalRequestInput,
  ArtistContext,
  OperatingSnapshot,
  ProjectRecord,
  TaskRecord,
  UpdateTaskInput,
  CreateTaskInput,
} from "../domain.js";
import { getRuntimeControl } from "../governance.js";

export interface SupabaseConnection {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  workspaceId: string;
  role?: string;
  email?: string;
}

export interface ActivityEvent {
  id: string;
  workspace_version: number;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  summary: string;
  changed_fields: string[];
  source_type: string;
  source_reference?: string | null;
  actor_user_id?: string | null;
  internal?: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RecentChanges {
  current_version: number;
  events: ActivityEvent[];
  has_more: boolean;
}

export interface ContactRecord {
  id: string;
  artist_workspace_id: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email_primary?: string | null;
  email_secondary?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  language?: string | null;
  instagram_or_social?: string | null;
  website?: string | null;
  preferred_channel?: string | null;
  notes?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OpportunityRecord {
  id: string;
  artist_workspace_id: string;
  contact_id?: string | null;
  organization_id?: string | null;
  opportunity_type: string;
  title: string;
  stage?: string | null;
  status?: string | null;
  priority?: string | null;
  market_city?: string | null;
  market_country?: string | null;
  value_amount?: number | null;
  value_currency?: string | null;
  date_window_start?: string | null;
  date_window_end?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  project_id?: string | null;
  notes?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  archived_at?: string | null;
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

function first<T>(value: T | T[]): T {
  if (Array.isArray(value)) {
    if (!value.length) throw new Error("Supabase returned no row.");
    return value[0] as T;
  }
  return value;
}

export class SupabaseAdapter {
  private readonly baseUrl = requiredEnv("SUPABASE_URL");
  private readonly anonKey = requiredEnv("SUPABASE_ANON_KEY");

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

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.connection.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${body.slice(0, 500)}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    return await this.request<T>(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  }

  private async query<T>(table: string, params: Record<string, string>): Promise<T[]> {
    const search = new URLSearchParams(params);
    return await this.request<T[]>(`/rest/v1/${table}?${search.toString()}`);
  }

  private ensureWorkspace(artistId?: string): string {
    if (artistId && artistId !== this.workspaceId) {
      throw new Error("Requested artist/workspace does not match the authenticated connection.");
    }
    return this.workspaceId;
  }

  async getArtistContext(artistId = this.workspaceId): Promise<ArtistContext> {
    const workspaceId = this.ensureWorkspace(artistId);
    const rows = await this.query<any>("artist_context", {
      select: "*",
      artist_workspace_id: `eq.${workspaceId}`,
      limit: "1",
    });
    const row = rows[0];
    if (!row) throw new Error("Artist context not found for this workspace.");
    const weeklyTop3 = Array.isArray(row.weekly_priorities)
      ? row.weekly_priorities.filter((x: unknown): x is string => typeof x === "string").slice(0, 3)
      : [];

    return {
      artistId: workspaceId,
      artistName: row.artist_name ?? undefined,
      stage: row.career_stage ?? undefined,
      twelveMonthObjective: row.objective_12m ?? undefined,
      ninetyDayGoal: row.goal_90d ?? undefined,
      weeklyTop3,
      currentBottleneck: row.bottleneck ?? undefined,
      nextImportantDate:
        row.next_deadline_date ?? row.next_deadline_label ?? undefined,
      source: "beyond_artist_os",
    };
  }

  async listTasks(artistId = this.workspaceId, includeDone = false): Promise<TaskRecord[]> {
    const workspaceId = this.ensureWorkspace(artistId);
    const params: Record<string, string> = {
      select: "*",
      artist_workspace_id: `eq.${workspaceId}`,
      order: "created_at.desc",
      limit: "200",
    };
    if (!includeDone) params.status = "neq.DONE";
    const rows = await this.query<any>("tasks", params);
    return rows.map((row) => ({
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
    const workspaceId = this.ensureWorkspace(artistId);
    const [artist, projects, tasks] = await Promise.all([
      this.getArtistContext(workspaceId),
      this.query<any>("projects", {
        select: "*",
        artist_workspace_id: `eq.${workspaceId}`,
        status: "neq.archived",
        order: "created_at.desc",
        limit: "100",
      }),
      this.listTasks(workspaceId, false),
    ]);

    const activeProjects: ProjectRecord[] = projects.map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      status: row.status ?? undefined,
      deadline: row.due_date ?? undefined,
      goal: row.description ?? undefined,
    }));

    return { artist, activeProjects, openTasks: tasks, runtime: getRuntimeControl() };
  }

  async getRecentChanges(afterVersion = 0, limit = 50): Promise<RecentChanges> {
    const value = await this.rpc<RecentChanges>("get_recent_changes", {
      _ws: this.workspaceId,
      _after_version: Math.max(0, Math.floor(afterVersion)),
      _before_version: null,
      _limit: Math.min(Math.max(1, Math.floor(limit)), 200),
    });
    return value;
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const workspaceId = this.ensureWorkspace(input.artistId);
    const value = first<any>(
      await this.rpc<any>("mcp_create_task", {
        _ws: workspaceId,
        _title: input.task,
        _next_action: input.nextAction,
        _priority: priorityToDb(input.priority) ?? "MEDIUM",
        _due_date: input.dueDate ?? null,
        _source_agent: input.sourceAgent || "chatgpt",
        _project_id: input.projectId ?? null,
        _agent_run_id: input.agentRunId ?? null,
      }),
    );
    return {
      id: value.id,
      task: value.title,
      status: statusFromDb(value.status),
      priority: priorityFromDb(value.priority),
      dueDate: value.due_date ?? undefined,
      nextAction: value.next_action ?? undefined,
      sourceAgent: value.source_agent ?? undefined,
      agentRunId: value.agent_run_id ?? undefined,
      projectId: value.project_id ?? undefined,
    };
  }

  async updateTask(input: UpdateTaskInput): Promise<TaskRecord> {
    const workspaceId = this.ensureWorkspace(input.artistId);
    const value = first<any>(
      await this.rpc<any>("mcp_update_task", {
        _ws: workspaceId,
        _task_id: input.taskId,
        _status: statusToDb(input.status) ?? null,
        _priority: priorityToDb(input.priority) ?? null,
        _due_date: input.dueDate ?? null,
        _next_action: input.nextAction ?? null,
        _agent_run_id: input.agentRunId ?? null,
      }),
    );
    return {
      id: value.id,
      task: value.title,
      status: statusFromDb(value.status),
      priority: priorityFromDb(value.priority),
      dueDate: value.due_date ?? undefined,
      nextAction: value.next_action ?? undefined,
      sourceAgent: value.source_agent ?? undefined,
      agentRunId: value.agent_run_id ?? undefined,
      projectId: value.project_id ?? undefined,
    };
  }

  async requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    const workspaceId = this.ensureWorkspace(input.artistId);
    const value = first<any>(
      await this.rpc<any>("mcp_request_approval", {
        _ws: workspaceId,
        _title: input.actionType,
        _description: input.summary,
        _requested_by: input.sourceAgent,
        _action_fingerprint: input.actionFingerprint,
        _related_object: input.relatedObject ?? null,
      }),
    );
    return {
      approvalId: value.id,
      state: "Pending",
      actionFingerprint: input.actionFingerprint,
    };
  }

  async logAgentRun(input: AgentRunInput): Promise<{ runId: string }> {
    const workspaceId = this.ensureWorkspace(input.artistId);
    const value = first<any>(
      await this.rpc<any>("mcp_log_automation_run", {
        _ws: workspaceId,
        _automation_key: input.sourceAgent || "chatgpt",
        _status: input.state,
        _input: {
          run_id: input.runId,
          trigger: input.trigger,
          approval_state: input.approvalState ?? null,
          action_fingerprint: input.actionFingerprint ?? null,
          related_object: input.relatedObject ?? null,
        },
        _output: input.notes ? { notes: input.notes } : {},
        _error: input.state === "Failed" ? input.notes ?? "Agent run failed." : null,
      }),
    );
    return { runId: String(value?.automation_key ?? input.runId) };
  }

  async searchContacts(query = "", limit = 25): Promise<ContactRecord[]> {
    const params: Record<string, string> = {
      select:
        "id,artist_workspace_id,display_name,first_name,last_name,email_primary,phone_primary,city,region,country,preferred_channel,source_type,source_reference,last_contact_at,next_follow_up_at,archived_at,created_at,updated_at",
      artist_workspace_id: `eq.${this.workspaceId}`,
      archived_at: "is.null",
      order: "updated_at.desc",
      limit: String(Math.min(Math.max(limit, 1), 100)),
    };
    const clean = query.trim();
    if (clean) {
      const escaped = clean.replace(/[(),]/g, " ");
      params.or = `(display_name.ilike.*${escaped}*,email_primary.ilike.*${escaped}*,city.ilike.*${escaped}*,country.ilike.*${escaped}*)`;
    }
    return await this.query<ContactRecord>("crm_contacts", params);
  }

  async getContact(contactId: string): Promise<Record<string, unknown>> {
    const [contacts, roles, orgLinks, interactions] = await Promise.all([
      this.query<ContactRecord>("crm_contacts", {
        select: "*",
        id: `eq.${contactId}`,
        artist_workspace_id: `eq.${this.workspaceId}`,
        limit: "1",
      }),
      this.query<any>("crm_contact_roles", {
        select: "*",
        contact_id: `eq.${contactId}`,
        artist_workspace_id: `eq.${this.workspaceId}`,
        order: "created_at.asc",
      }),
      this.query<any>("crm_contact_organizations", {
        select: "id,contact_id,organization_id,role_title,is_primary,crm_organizations(id,name,organization_type,city,country,website)",
        contact_id: `eq.${contactId}`,
        artist_workspace_id: `eq.${this.workspaceId}`,
      }),
      this.query<any>("crm_interactions", {
        select: "id,interaction_type,occurred_at,summary,outcome,next_action,next_action_due_at,project_id,task_id,source_type",
        contact_id: `eq.${contactId}`,
        artist_workspace_id: `eq.${this.workspaceId}`,
        order: "occurred_at.desc",
        limit: "50",
      }),
    ]);
    if (!contacts[0]) throw new Error("Contact not found in this workspace.");
    return { contact: contacts[0], roles, organizations: orgLinks, recentInteractions: interactions };
  }

  async createContact(payload: Record<string, unknown>): Promise<ContactRecord> {
    return first<ContactRecord>(
      await this.rpc<ContactRecord | ContactRecord[]>("mcp_create_contact", {
        _ws: this.workspaceId,
        _payload: payload,
      }),
    );
  }

  async updateContact(contactId: string, payload: Record<string, unknown>): Promise<ContactRecord> {
    return first<ContactRecord>(
      await this.rpc<ContactRecord | ContactRecord[]>("mcp_update_contact", {
        _ws: this.workspaceId,
        _contact_id: contactId,
        _payload: payload,
      }),
    );
  }

  async logInteraction(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return first<Record<string, unknown>>(
      await this.rpc<Record<string, unknown> | Record<string, unknown>[]>("mcp_log_interaction", {
        _ws: this.workspaceId,
        _payload: payload,
      }),
    );
  }

  async searchOpportunities(query = "", status = "open", limit = 25): Promise<OpportunityRecord[]> {
    const params: Record<string, string> = {
      select: "*",
      artist_workspace_id: `eq.${this.workspaceId}`,
      archived_at: "is.null",
      order: "updated_at.desc",
      limit: String(Math.min(Math.max(limit, 1), 100)),
    };
    if (status) params.status = `eq.${status}`;
    const clean = query.trim();
    if (clean) {
      const escaped = clean.replace(/[(),]/g, " ");
      params.or = `(title.ilike.*${escaped}*,market_city.ilike.*${escaped}*,market_country.ilike.*${escaped}*)`;
    }
    return await this.query<OpportunityRecord>("crm_opportunities", params);
  }

  async createOpportunity(payload: Record<string, unknown>): Promise<OpportunityRecord> {
    return first<OpportunityRecord>(
      await this.rpc<OpportunityRecord | OpportunityRecord[]>("mcp_create_opportunity", {
        _ws: this.workspaceId,
        _payload: payload,
      }),
    );
  }

  async updateWeeklyPriorities(priorities: string[]): Promise<ArtistContext> {
    const value = first<any>(
      await this.rpc<any>("mcp_update_weekly_priorities", {
        _ws: this.workspaceId,
        _priorities: priorities,
      }),
    );
    return {
      artistId: this.workspaceId,
      artistName: value.artist_name ?? undefined,
      stage: value.career_stage ?? undefined,
      twelveMonthObjective: value.objective_12m ?? undefined,
      ninetyDayGoal: value.goal_90d ?? undefined,
      weeklyTop3: Array.isArray(value.weekly_priorities)
        ? value.weekly_priorities.filter((x: unknown): x is string => typeof x === "string").slice(0, 3)
        : [],
      currentBottleneck: value.bottleneck ?? undefined,
      nextImportantDate: value.next_deadline_date ?? value.next_deadline_label ?? undefined,
      source: "beyond_artist_os",
    };
  }

  async getDiscoveryStatus(): Promise<Record<string, unknown>> {
    const [workspaceRows, definitions, answers] = await Promise.all([
      this.query<any>("artist_workspaces", {
        select: "id,delivery_category,workspace_version",
        id: `eq.${this.workspaceId}`,
        limit: "1",
      }),
      this.query<any>("question_definitions", {
        select: "id,qid,delivery_scope,required,diy_core,team_only,active",
        active: "eq.true",
        order: "sort_order.asc",
        limit: "1000",
      }),
      this.query<any>("artist_question_answers", {
        select: "question_definition_id,status",
        artist_workspace_id: `eq.${this.workspaceId}`,
        limit: "1000",
      }),
    ]);
    const workspace = workspaceRows[0] ?? {};
    const delivery = workspace.delivery_category ?? null;
    const applicable = definitions.filter((q: any) => {
      if (!q.active) return false;
      if (delivery === "DIY") return q.diy_core === true;
      return Array.isArray(q.delivery_scope) && q.delivery_scope.includes(delivery);
    });
    const answerByQuestion = new Map(answers.map((a: any) => [a.question_definition_id, a.status]));
    const resolvedStatuses = new Set(["answered", "verified", "not_applicable"]);
    const artistQuestions = applicable.filter((q: any) => !q.team_only);
    const resolved = applicable.filter((q: any) => resolvedStatuses.has(String(answerByQuestion.get(q.id) ?? ""))).length;
    const artistResolved = artistQuestions.filter((q: any) => resolvedStatuses.has(String(answerByQuestion.get(q.id) ?? ""))).length;
    return {
      delivery_category: delivery,
      team: { required: applicable.length, resolved, remaining: Math.max(0, applicable.length - resolved) },
      artist: {
        required: artistQuestions.length,
        resolved: artistResolved,
        remaining: Math.max(0, artistQuestions.length - artistResolved),
      },
      workspace_version: workspace.workspace_version ?? 0,
    };
  }
}
