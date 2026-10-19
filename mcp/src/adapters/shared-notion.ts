import type { ArtistContext, OperatingSnapshot, TaskRecord, CreateTaskInput, UpdateTaskInput, RuntimeControl } from "../domain.js";
import { getRuntimeControl } from "../governance.js";

// Artist IDs are Notion page IDs in the shared Artist Master Context database.
// The OAuth owner is mapped to an explicit allowlist server-side, never by the model.
export function allowedArtistsForOwner(ownerId: string, workspaceId: string, raw = process.env.NOTION_ARTIST_ACL_JSON): string[] {
  if (!raw || !ownerId || !workspaceId) throw new Error("Artist ACL is not configured.");
  let acl: Record<string, unknown>;
  try { acl = JSON.parse(raw); } catch { throw new Error("Invalid artist ACL configuration."); }
  if (!acl || typeof acl !== "object" || Array.isArray(acl)) throw new Error("Invalid artist ACL configuration.");
  const entries = acl[workspaceId + ":" + ownerId];
  if (!Array.isArray(entries) || !entries.length || !entries.every((x) => typeof x === "string" && /^[a-f0-9-]{32,36}$/i.test(x))) {
    throw new Error("OAuth owner has no valid artist authorization.");
  }
  return [...new Set(entries)];
}

export function assertArtistAllowed(artistId: string, allowed: readonly string[]): void {
  if (!allowed.includes(artistId)) throw new Error("Artist access denied.");
}

type Page = { id: string; url?: string; parent?: { database_id?: string }; properties?: Record<string, any> };
function text(p: any): string {
  if (!p) return "";
  if (p.type === "title") return (p.title ?? []).map((x: any) => x.plain_text ?? x.text?.content ?? "").join("");
  if (p.type === "rich_text") return (p.rich_text ?? []).map((x: any) => x.plain_text ?? x.text?.content ?? "").join("");
  if (p.type === "select") return p.select?.name ?? "";
  if (p.type === "status") return p.status?.name ?? "";
  if (p.type === "date") return p.date?.start ?? "";
  return "";
}
const rich = (value: string) => ({ rich_text: [{ text: { content: value.slice(0, 1900) } }] });
const title = (value: string) => ({ title: [{ text: { content: value.slice(0, 1900) } }] });

export class SharedNotionArtistAdapter {
  private readonly token: string;
  private readonly artistsDb: string;
  private readonly tasksDb: string;
  private readonly controlDb: string;
  private readonly allowed: readonly string[];
  constructor(config: { token: string; artistsDb: string; tasksDb: string; controlDb?: string; allowedArtistIds: string[] }) {
    this.token = config.token;
    this.artistsDb = config.artistsDb;
    this.tasksDb = config.tasksDb;
    this.controlDb = config.controlDb ?? "";
    this.allowed = [...config.allowedArtistIds];
    if (!this.token || !this.allowed.length || !this.artistsDb || !this.tasksDb) throw new Error("Shared Notion connector is not configured.");
  }
  private async request(path: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetch("https://api.notion.com/v1" + path, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + this.token, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Notion request failed (HTTP " + response.status + ").");
    return response.json();
  }
  async getRuntimeControl(): Promise<RuntimeControl> {
    if (!this.controlDb) throw new Error("Notion Automation Control database is required.");
    const result = await this.request("/databases/" + this.controlDb + "/query", "POST", {
      page_size: 2, filter: { property: "Control", title: { equals: "Global Manager Policy" } },
    });
    if (result.has_more || result.results?.length !== 1) throw new Error("Automation Control is missing or ambiguous.");
    const p = result.results[0];
    const mode = text(p.properties?.Mode);
    const external = text(p.properties?.["External Actions"]).replace(/ /g, "_");
    if (!["PAUSED", "SUPERVISED", "ACTIVE"].includes(mode) || !["BLOCKED", "APPROVAL_ONLY", "ALLOWED"].includes(external)) {
      throw new Error("Invalid Automation Control policy.");
    }
    const env = getRuntimeControl();
    return {
      mode: env.mode === "PAUSED" || mode === "PAUSED" ? "PAUSED" : "SUPERVISED",
      externalActions: env.externalActions === "BLOCKED" || external === "BLOCKED" ? "BLOCKED" : "APPROVAL_ONLY",
    };
  }
  private async assertWriteAllowed(): Promise<void> {
    if ((await this.getRuntimeControl()).mode === "PAUSED") throw new Error("Music OS runtime is PAUSED. Writes are disabled.");
  }
  private async artist(artistId: string): Promise<Page> {
    assertArtistAllowed(artistId, this.allowed);
    const page: Page = await this.request("/pages/" + encodeURIComponent(artistId));
    if (page.parent?.database_id?.replace(/-/g, "") !== this.artistsDb.replace(/-/g, "")) {
      throw new Error("Artist is not in the configured Artist Master Context database.");
    }
    return page;
  }
  async listArtists(): Promise<Array<{ artistId: string; artistName: string }>> {
    const result = [];
    for (const id of this.allowed) {
      const p = await this.artist(id);
      result.push({ artistId: id, artistName: text(p.properties?.Artist) });
    }
    return result;
  }
  async getArtistContext(artistId: string): Promise<ArtistContext> {
    const p = await this.artist(artistId);
    return {
      artistId,
      artistName: text(p.properties?.Artist),
      stage: text(p.properties?.["Career Stage"]),
      twelveMonthObjective: text(p.properties?.["12 Month Goal"]),
      ninetyDayGoal: text(p.properties?.["90 Day Goal"]),
      weeklyTop3: [],
      currentBottleneck: text(p.properties?.["Current Bottleneck"]),
      nextImportantDate: text(p.properties?.["Next Deadline"]),
      source: "notion",
    };
  }
  private async taskPage(taskId: string, artistId: string): Promise<Page> {
    const p: Page = await this.request("/pages/" + encodeURIComponent(taskId));
    if (p.parent?.database_id?.replace(/-/g, "") !== this.tasksDb.replace(/-/g, "") ||
        text(p.properties?.["Artist ID"]) !== artistId) throw new Error("Task access denied.");
    return p;
  }
  private taskRecord(p: Page): TaskRecord {
    return {
      id: p.id, task: text(p.properties?.Task),
      status: (text(p.properties?.Status) || "Not Started") as TaskRecord["status"],
      priority: text(p.properties?.Priority) as TaskRecord["priority"],
      dueDate: text(p.properties?.["Due Date"]),
      nextAction: text(p.properties?.["Next Action"]),
      sourceAgent: text(p.properties?.["Source Agent"]),
      approvalState: text(p.properties?.["Approval State"]) as TaskRecord["approvalState"],
      url: p.url,
    };
  }
  async getOperatingSnapshot(artistId: string): Promise<OperatingSnapshot> {
    const artist = await this.getArtistContext(artistId);
    const openTasks: TaskRecord[] = [];
    let cursor: string | undefined;
    do {
      const body: Record<string, unknown> = {
        page_size: 100,
        filter: { property: "Artist ID", rich_text: { equals: artistId } },
      };
      if (cursor) body.start_cursor = cursor;
      const result = await this.request("/databases/" + this.tasksDb + "/query", "POST", body);
      for (const p of result.results ?? []) {
        if (p.parent?.database_id?.replace(/-/g, "") !== this.tasksDb.replace(/-/g, "") || text(p.properties?.["Artist ID"]) !== artistId) throw new Error("Notion returned an out-of-scope task.");
        if (text(p.properties?.Status) !== "Done") openTasks.push(this.taskRecord(p));
      }
      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);
    return { artist, activeProjects: [], openTasks, runtime: await this.getRuntimeControl() };
  }
  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    if (input.approvalState && !["Not Required", "Pending"].includes(input.approvalState)) throw new Error("Approval decisions cannot be set by an agent.");
    await this.artist(input.artistId);
    await this.assertWriteAllowed();
    if (input.projectId) throw new Error("Project linking is unavailable until scoped project ownership is configured.");
    const properties: Record<string, unknown> = {
      Task: title(input.task), "Artist ID": rich(input.artistId),
      Status: { status: { name: input.status ?? "Not Started" } },
      Priority: { select: { name: input.priority ?? "Medium" } },
      "Next Action": rich(input.nextAction),
      "Source Agent": rich(input.sourceAgent),
      "Approval State": { select: { name: input.approvalState ?? "Not Required" } },
    };
    if (input.dueDate) properties["Due Date"] = { date: { start: input.dueDate } };
    const p: Page = await this.request("/pages", "POST", { parent: { database_id: this.tasksDb }, properties });
    if (p.parent?.database_id?.replace(/-/g, "") !== this.tasksDb.replace(/-/g, "") || text(p.properties?.["Artist ID"]) !== input.artistId) throw new Error("Created task ownership verification failed.");
    return this.taskRecord(p);
  }
  async updateTask(input: UpdateTaskInput): Promise<TaskRecord> {
    await this.artist(input.artistId);
    await this.taskPage(input.taskId, input.artistId);
    await this.assertWriteAllowed();
    if (input.approvalState) throw new Error("Approval decisions cannot be set by an agent.");
    const properties: Record<string, unknown> = {};
    if (input.status) properties.Status = { status: { name: input.status } };
    if (input.priority) properties.Priority = { select: { name: input.priority } };
    if (input.dueDate) properties["Due Date"] = { date: { start: input.dueDate } };
    if (input.nextAction) properties["Next Action"] = rich(input.nextAction);
    if (Object.keys(properties).length) await this.request("/pages/" + encodeURIComponent(input.taskId), "PATCH", { properties });
    return this.taskRecord(await this.taskPage(input.taskId, input.artistId));
  }
}
