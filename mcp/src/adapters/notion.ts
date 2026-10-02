import { randomUUID } from "node:crypto";
import type {
  AgentRunInput,
  ApprovalRequest,
  ApprovalRequestInput,
  ArtistContext,
  CreateTaskInput,
  OperatingSnapshot,
  ProjectRecord,
  TaskRecord,
  UpdateTaskInput,
  WorkflowDefinition,
  WorkflowRun,
  StartWorkflowInput,
  AdvanceWorkflowInput,
} from "../domain.js";
import { getRuntimeControl } from "../governance.js";
import type { MusicOsAdapter } from "./adapter.js";

type NotionPage = { id: string; url?: string; properties?: Record<string, unknown>; object?: string; title?: unknown[] };

export interface NotionAdapterConfig {
  token?: string;
  artistContextPageId?: string;
  projectsDatabaseId?: string;
  tasksDatabaseId?: string;
  automationRunsDatabaseId?: string;
  workflowRegistryDatabaseId?: string;
  workflowRunsDatabaseId?: string;
}

const NOTION_VERSION = "2022-06-28";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function plainText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const text = value.map((v: any) => v?.plain_text ?? v?.text?.content ?? "").join("").trim();
  return text || undefined;
}

function propertyCheckbox(page: NotionPage, name: string): boolean | undefined {
  const p: any = page.properties?.[name];
  if (!p || p.type !== "checkbox") return undefined;
  return Boolean(p.checkbox);
}

function propertyText(page: NotionPage, name: string): string | undefined {
  const p: any = page.properties?.[name];
  if (!p) return undefined;
  if (p.type === "title") return plainText(p.title);
  if (p.type === "rich_text") return plainText(p.rich_text);
  if (p.type === "status") return p.status?.name;
  if (p.type === "select") return p.select?.name;
  if (p.type === "date") return p.date?.start;
  return undefined;
}

export class NotionAdapter implements MusicOsAdapter {
  private readonly token: string;
  private artistContextPageId?: string;
  private projectsDb?: string;
  private tasksDb?: string;
  private runsDb?: string;
  private workflowRegistryDb?: string;
  private workflowRunsDb?: string;
  private resourcesResolved = false;

  constructor(config: NotionAdapterConfig = {}) {
    this.token = config.token ?? requiredEnv("NOTION_TOKEN");
    this.artistContextPageId = config.artistContextPageId ?? process.env.MUSIC_OS_ARTIST_CONTEXT_PAGE_ID;
    this.projectsDb = config.projectsDatabaseId ?? process.env.MUSIC_OS_PROJECTS_DATABASE_ID;
    this.tasksDb = config.tasksDatabaseId ?? process.env.MUSIC_OS_TASKS_DATABASE_ID;
    this.runsDb = config.automationRunsDatabaseId ?? process.env.MUSIC_OS_AUTOMATION_RUNS_DATABASE_ID;
    this.workflowRegistryDb =
      config.workflowRegistryDatabaseId ?? process.env.MUSIC_OS_WORKFLOW_REGISTRY_DATABASE_ID;
    this.workflowRunsDb =
      config.workflowRunsDatabaseId ?? process.env.MUSIC_OS_WORKFLOW_RUNS_DATABASE_ID;
    this.resourcesResolved = Boolean(
      this.artistContextPageId &&
      this.projectsDb &&
      this.tasksDb &&
      this.runsDb &&
      this.workflowRegistryDb &&
      this.workflowRunsDb
    );
  }

  private titleOf(item: any): string {
    if (item?.object === "database") return plainText(item.title) ?? "";
    const properties = item?.properties ?? {};
    for (const value of Object.values(properties) as any[]) {
      if (value?.type === "title") return plainText(value.title) ?? "";
    }
    return "";
  }

  private async resolveResources(): Promise<void> {
    if (this.resourcesResolved) return;

    const result = await this.request("/search", {
      method: "POST",
      body: JSON.stringify({ page_size: 100 }),
    });

    const items = result.results ?? [];
    const normalized = items.map((item: any) => ({
      id: item.id as string,
      object: item.object as string,
      title: this.titleOf(item).trim(),
    }));

    const findOne = (object: string, candidates: string[]): string | undefined => {
      const matches = normalized.filter((item: any) => {
        if (item.object !== object) return false;
        const title = item.title.toLowerCase();
        return candidates.some((candidate) => title === candidate || title.includes(candidate));
      });
      if (matches.length === 1) return matches[0].id;
      if (matches.length > 1) {
        const exact = matches.find((item: any) => candidates.includes(item.title.toLowerCase()));
        if (exact) return exact.id;
      }
      return undefined;
    };

    this.artistContextPageId ??= findOne("page", [
      "artist master context",
      "command center",
      "welcome to your new music os",
    ]);
    this.projectsDb ??= findOne("database", ["projects", "project"]);
    this.tasksDb ??= findOne("database", ["tasks", "task"]);
    this.runsDb ??= findOne("database", ["automation runs", "agent runs"]);
    this.workflowRegistryDb ??= findOne("database", ["workflow registry"]);
    this.workflowRunsDb ??= findOne("database", ["workflow runs"]);

    if (
      !this.artistContextPageId ||
      !this.projectsDb ||
      !this.tasksDb ||
      !this.runsDb ||
      !this.workflowRegistryDb ||
      !this.workflowRunsDb
    ) {
      const visible = normalized
        .filter((item: any) => item.title)
        .map((item: any) => `${item.object}: ${item.title}`)
        .join(", ");
      throw new Error(
        "Could not auto-discover the Music OS pages/databases in this Notion connection. " +
          "Expected Artist Master Context/Command Center, Projects, Tasks, Automation Runs, Workflow Registry, and Workflow Runs. " +
          "Visible objects: " + visible,
      );
    }

    this.resourcesResolved = true;
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch("https://api.notion.com/v1" + path, {
      ...init,
      headers: {
        Authorization: "Bearer " + this.token,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error("Notion API " + response.status + ": " + await response.text());
    }
    return response.json();
  }

  private async readPageText(pageId: string): Promise<string> {
    const chunks: string[] = [];
    let cursor: string | undefined;
    do {
      const qs = new URLSearchParams({ page_size: "100" });
      if (cursor) qs.set("start_cursor", cursor);
      const result = await this.request("/blocks/" + pageId + "/children?" + qs.toString());
      for (const block of result.results ?? []) {
        const payload = block[block.type];
        const text = plainText(payload?.rich_text);
        if (text) chunks.push(text);
      }
      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);
    return chunks.join("\n");
  }

  private valueAfterLabel(label: string, text: string): string | undefined {
    const line = text.split("\n").find((candidate) => candidate.toLowerCase().startsWith(label.toLowerCase()));
    if (!line) return undefined;
    const cleaned = line.slice(label.length).replace(/^\s*[:—-]?\s*/, "").trim();
    return cleaned || undefined;
  }

  async getArtistContext(artistId: string): Promise<ArtistContext> {
    await this.resolveResources();
    const text = await this.readPageText(this.artistContextPageId!);
    const weeklyTop3 = [1, 2, 3]
      .map((n) => this.valueAfterLabel("Priority #" + n, text))
      .filter((v): v is string => Boolean(v));

    return {
      artistId,
      artistName: this.valueAfterLabel("Artist / Project Name", text),
      stage: this.valueAfterLabel("Current Stage", text) ?? this.valueAfterLabel("Current Career Stage", text),
      twelveMonthObjective: this.valueAfterLabel("12-Month Career Objective", text),
      ninetyDayGoal: this.valueAfterLabel("90-Day Goal", text) ?? this.valueAfterLabel("Current 90-Day Goal", text),
      weeklyTop3,
      currentBottleneck: this.valueAfterLabel("Current Bottleneck", text),
      nextImportantDate: this.valueAfterLabel("Next Important Date / Deadline", text),
      source: "notion",
      rawText: text,
    };
  }

  private async queryDatabase(databaseId: string, body: Record<string, unknown>): Promise<NotionPage[]> {
    const result = await this.request("/databases/" + databaseId + "/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return result.results ?? [];
  }

  async getOperatingSnapshot(artistId: string): Promise<OperatingSnapshot> {
    await this.resolveResources();
    const [artist, projectPages, taskPages] = await Promise.all([
      this.getArtistContext(artistId),
      this.queryDatabase(this.projectsDb!, {
        page_size: 50,
        filter: { property: "Status", status: { does_not_equal: "Archived" } },
      }),
      this.queryDatabase(this.tasksDb!, {
        page_size: 100,
        filter: { property: "Status", status: { does_not_equal: "Done" } },
      }),
    ]);

    const activeProjects: ProjectRecord[] = projectPages.map((p) => ({
      id: p.id,
      name: propertyText(p, "Name") ?? "Untitled project",
      status: propertyText(p, "Status"),
      area: propertyText(p, "Area"),
      priority: propertyText(p, "Priority"),
      deadline: propertyText(p, "Deadline"),
      goal: propertyText(p, "Goal"),
      url: p.url,
    }));

    const openTasks: TaskRecord[] = taskPages.map((p) => ({
      id: p.id,
      task: propertyText(p, "Task") ?? "Untitled task",
      status: (propertyText(p, "Status") ?? "Not Started") as TaskRecord["status"],
      priority: propertyText(p, "Priority") as TaskRecord["priority"],
      dueDate: propertyText(p, "Due Date"),
      nextAction: propertyText(p, "Next Action"),
      sourceAgent: propertyText(p, "Source Agent"),
      approvalState: propertyText(p, "Approval State") as TaskRecord["approvalState"],
      agentRunId: propertyText(p, "Agent Run ID"),
      url: p.url,
    }));

    return { artist, activeProjects, openTasks, runtime: getRuntimeControl() };
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    await this.resolveResources();
    const properties: Record<string, unknown> = {
      Task: { title: [{ text: { content: input.task } }] },
      Status: { status: { name: input.status ?? "Not Started" } },
      Priority: { select: { name: input.priority ?? "Medium" } },
      "Next Action": { rich_text: [{ text: { content: input.nextAction } }] },
      "Source Agent": { select: { name: input.sourceAgent } },
      "Approval State": { select: { name: input.approvalState ?? "Not Required" } },
    };
    if (input.dueDate) properties["Due Date"] = { date: { start: input.dueDate } };
    if (input.agentRunId) properties["Agent Run ID"] = { rich_text: [{ text: { content: input.agentRunId } }] };
    if (input.projectId) properties.Project = { relation: [{ id: input.projectId }] };

    const page = await this.request("/pages", {
      method: "POST",
      body: JSON.stringify({ parent: { database_id: this.tasksDb }, properties }),
    });

    return {
      id: page.id,
      task: input.task,
      status: input.status ?? "Not Started",
      priority: input.priority ?? "Medium",
      dueDate: input.dueDate,
      nextAction: input.nextAction,
      sourceAgent: input.sourceAgent,
      approvalState: input.approvalState ?? "Not Required",
      agentRunId: input.agentRunId,
      projectId: input.projectId,
      url: page.url,
    };
  }

  async updateTask(input: UpdateTaskInput): Promise<TaskRecord> {
    const properties: Record<string, unknown> = {};
    if (input.status) properties.Status = { status: { name: input.status } };
    if (input.priority) properties.Priority = { select: { name: input.priority } };
    if (input.dueDate) properties["Due Date"] = { date: { start: input.dueDate } };
    if (input.nextAction) properties["Next Action"] = { rich_text: [{ text: { content: input.nextAction } }] };
    if (input.approvalState) properties["Approval State"] = { select: { name: input.approvalState } };
    if (input.agentRunId) properties["Agent Run ID"] = { rich_text: [{ text: { content: input.agentRunId } }] };

    await this.request("/pages/" + input.taskId, { method: "PATCH", body: JSON.stringify({ properties }) });
    const page = await this.request("/pages/" + input.taskId);

    return {
      id: page.id,
      task: propertyText(page, "Task") ?? input.taskId,
      status: (propertyText(page, "Status") ?? input.status ?? "Not Started") as TaskRecord["status"],
      priority: propertyText(page, "Priority") as TaskRecord["priority"],
      dueDate: propertyText(page, "Due Date"),
      nextAction: propertyText(page, "Next Action"),
      sourceAgent: propertyText(page, "Source Agent"),
      approvalState: propertyText(page, "Approval State") as TaskRecord["approvalState"],
      agentRunId: propertyText(page, "Agent Run ID"),
      url: page.url,
    };
  }

  async requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    const task = await this.createTask({
      artistId: input.artistId,
      task: "Approval: " + input.actionType,
      nextAction: input.summary + "\nFingerprint: " + input.actionFingerprint,
      status: "Waiting",
      priority: "High",
      sourceAgent: input.sourceAgent,
      approvalState: "Pending",
    });
    return { approvalId: task.id, state: "Pending", actionFingerprint: input.actionFingerprint };
  }

  private workflowFromPage(page: NotionPage): WorkflowDefinition {
    return {
      workflowId: propertyText(page, "Workflow ID") ?? page.id,
      version: propertyText(page, "Version") ?? "1.0.0",
      name: propertyText(page, "Name") ?? "Unnamed workflow",
      purpose: propertyText(page, "Purpose"),
      ownerAgent: propertyText(page, "Owner Agent"),
      trigger: propertyText(page, "Trigger"),
      requiredContext: propertyText(page, "Required Context"),
      preconditions: propertyText(page, "Preconditions"),
      steps: propertyText(page, "Steps"),
      decisionRules: propertyText(page, "Decision Rules"),
      approvalGates: propertyText(page, "Approval Gates"),
      writeBack: propertyText(page, "Write Back"),
      kpis: propertyText(page, "KPIs"),
      definitionOfDone: propertyText(page, "Definition of Done"),
      nextWorkflows: (propertyText(page, "Next Workflows") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      active: propertyCheckbox(page, "Active") ?? false,
      url: page.url,
    };
  }

  private workflowRunFromPage(page: NotionPage): WorkflowRun {
    return {
      runId: propertyText(page, "Run ID") ?? page.id,
      artistId: propertyText(page, "Artist ID") ?? "default",
      workflowId: propertyText(page, "Workflow ID") ?? "",
      workflowVersion: propertyText(page, "Workflow Version") ?? "1.0.0",
      relatedObject: propertyText(page, "Related Object"),
      state: (propertyText(page, "State") ?? "NOT_STARTED") as WorkflowRun["state"],
      currentStep: propertyText(page, "Current Step"),
      trigger: propertyText(page, "Trigger") ?? "",
      contextSnapshot: propertyText(page, "Context Snapshot"),
      approvalState: (propertyText(page, "Approval State") ?? "Not Required") as WorkflowRun["approvalState"],
      blockedReason: propertyText(page, "Blocked Reason"),
      nextAction: propertyText(page, "Next Action"),
      result: propertyText(page, "Result"),
      startedAt: propertyText(page, "Started At") ?? new Date().toISOString(),
      updatedAt: propertyText(page, "Updated At") ?? new Date().toISOString(),
      url: page.url,
    };
  }

  async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    await this.resolveResources();
    const pages = await this.queryDatabase(this.workflowRegistryDb!, {
      page_size: 10,
      filter: { property: "Workflow ID", title: { equals: workflowId } },
    });
    const page = pages.find((candidate) => propertyText(candidate, "Workflow ID") === workflowId);
    if (!page) throw new Error("Workflow not found: " + workflowId);
    const workflow = this.workflowFromPage(page);
    if (!workflow.active) throw new Error("Workflow is inactive: " + workflowId);
    return workflow;
  }

  async listWorkflows(): Promise<WorkflowDefinition[]> {
    await this.resolveResources();
    const pages = await this.queryDatabase(this.workflowRegistryDb!, {
      page_size: 100,
      filter: { property: "Active", checkbox: { equals: true } },
    });
    return pages.map((page) => this.workflowFromPage(page));
  }

  async startWorkflow(input: StartWorkflowInput): Promise<WorkflowRun> {
    await this.resolveResources();
    const workflow = await this.getWorkflow(input.workflowId);
    const now = new Date().toISOString();
    const runId = randomUUID();
    const properties: Record<string, unknown> = {
      "Run ID": { title: [{ text: { content: runId } }] },
      "Artist ID": { rich_text: [{ text: { content: input.artistId } }] },
      "Workflow ID": { rich_text: [{ text: { content: workflow.workflowId } }] },
      "Workflow Version": { rich_text: [{ text: { content: workflow.version } }] },
      State: { select: { name: "CONTEXT_CHECK" } },
      Trigger: { rich_text: [{ text: { content: input.trigger } }] },
      "Approval State": { select: { name: "Not Required" } },
      "Next Action": { rich_text: [{ text: { content: "Validate required context and preconditions." } }] },
      "Started At": { date: { start: now } },
      "Updated At": { date: { start: now } },
    };
    if (input.relatedObject) properties["Related Object"] = { rich_text: [{ text: { content: input.relatedObject } }] };
    if (input.contextSnapshot) properties["Context Snapshot"] = { rich_text: [{ text: { content: input.contextSnapshot.slice(0, 1900) } }] };

    const page = await this.request("/pages", {
      method: "POST",
      body: JSON.stringify({ parent: { database_id: this.workflowRunsDb }, properties }),
    });
    return this.workflowRunFromPage(page);
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRun> {
    await this.resolveResources();
    const pages = await this.queryDatabase(this.workflowRunsDb!, {
      page_size: 10,
      filter: { property: "Run ID", title: { equals: runId } },
    });
    const page = pages.find((candidate) => propertyText(candidate, "Run ID") === runId);
    if (!page) throw new Error("Workflow run not found: " + runId);
    return this.workflowRunFromPage(page);
  }

  async advanceWorkflow(input: AdvanceWorkflowInput): Promise<WorkflowRun> {
    await this.resolveResources();
    const pages = await this.queryDatabase(this.workflowRunsDb!, {
      page_size: 10,
      filter: { property: "Run ID", title: { equals: input.runId } },
    });
    const page = pages.find((candidate) => propertyText(candidate, "Run ID") === input.runId);
    if (!page) throw new Error("Workflow run not found: " + input.runId);
    const existing = this.workflowRunFromPage(page);
    if (existing.artistId !== input.artistId) throw new Error("Workflow run belongs to a different artist.");

    const properties: Record<string, unknown> = {
      "Updated At": { date: { start: new Date().toISOString() } },
    };
    if (input.state) properties.State = { select: { name: input.state } };
    if (input.currentStep !== undefined) properties["Current Step"] = { rich_text: [{ text: { content: input.currentStep } }] };
    if (input.approvalState) properties["Approval State"] = { select: { name: input.approvalState } };
    if (input.blockedReason !== undefined) properties["Blocked Reason"] = { rich_text: [{ text: { content: input.blockedReason } }] };
    if (input.nextAction !== undefined) properties["Next Action"] = { rich_text: [{ text: { content: input.nextAction } }] };
    if (input.result !== undefined) properties.Result = { rich_text: [{ text: { content: input.result.slice(0, 1900) } }] };

    const updated = await this.request("/pages/" + page.id, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return this.workflowRunFromPage(updated);
  }

  async logAgentRun(input: AgentRunInput): Promise<{ runId: string; url?: string }> {
    await this.resolveResources();
    const properties: Record<string, unknown> = {
      "Run ID": { title: [{ text: { content: input.runId } }] },
      "Source Agent": { select: { name: input.sourceAgent } },
      Trigger: { rich_text: [{ text: { content: input.trigger } }] },
      "Run State": { select: { name: input.state } },
      "Approval State": { select: { name: input.approvalState ?? "Not Required" } },
    };
    if (input.actionFingerprint) properties["Action Fingerprint"] = { rich_text: [{ text: { content: input.actionFingerprint } }] };
    if (input.relatedObject) properties["Related Object"] = { rich_text: [{ text: { content: input.relatedObject } }] };
    if (input.notes) properties.Notes = { rich_text: [{ text: { content: input.notes } }] };

    const page = await this.request("/pages", {
      method: "POST",
      body: JSON.stringify({ parent: { database_id: this.runsDb }, properties }),
    });
    return { runId: input.runId, url: page.url };
  }
}
