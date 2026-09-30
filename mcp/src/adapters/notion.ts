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
} from "../domain.js";
import { getRuntimeControl } from "../governance.js";
import type { MusicOsAdapter } from "./adapter.js";

type NotionPage = { id: string; url?: string; properties?: Record<string, unknown> };
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
  private readonly token = requiredEnv("NOTION_TOKEN");
  private readonly artistContextPageId = requiredEnv("MUSIC_OS_ARTIST_CONTEXT_PAGE_ID");
  private readonly projectsDb = requiredEnv("MUSIC_OS_PROJECTS_DATABASE_ID");
  private readonly tasksDb = requiredEnv("MUSIC_OS_TASKS_DATABASE_ID");
  private readonly runsDb = requiredEnv("MUSIC_OS_AUTOMATION_RUNS_DATABASE_ID");

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
    const text = await this.readPageText(this.artistContextPageId);
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
    const [artist, projectPages, taskPages] = await Promise.all([
      this.getArtistContext(artistId),
      this.queryDatabase(this.projectsDb, {
        page_size: 50,
        filter: { property: "Status", status: { does_not_equal: "Archived" } },
      }),
      this.queryDatabase(this.tasksDb, {
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

  async logAgentRun(input: AgentRunInput): Promise<{ runId: string; url?: string }> {
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
