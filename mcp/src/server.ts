import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { NotionAdapter } from "./adapters/notion.js";
import { SupabaseAdapter, type SupabaseConnection } from "./adapters/supabase.js";
import {
  actionFingerprint,
  assertExternalActionMayBeStaged,
  assertInternalWriteAllowed,
  getRuntimeControl,
} from "./governance.js";

const dashboardHtml = readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");
const MCP_PATH = "/mcp";
const port = Number(process.env.PORT ?? process.env.MUSIC_OS_PORT ?? 8787);
const publicOrigin = (process.env.MCP_PUBLIC_URL ?? "https://independent-artist-os-mcp.onrender.com").replace(/\/$/, "");
const SUPABASE_PUBLIC_ANON_KEY =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0eHdkeG5iZm1sYWZ1bXdheGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODg0MTgsImV4cCI6MjA4ODQ2NDQxOH0._ebQ9m5J6dbQCzqqFmxSFPk4AGYB1RdATCQVAPV-yXw";
const resourceId = `${publicOrigin}${MCP_PATH}`;
const oauthIssuer = publicOrigin;
const usedAuthorizationCodes = new Set<string>();

const artistId = () => process.env.MUSIC_OS_ARTIST_ID ?? "default";

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function secret(): string {
  const value = process.env.MCP_AUTH_TOKEN;
  if (!value) throw new Error("Missing required environment variable: MCP_AUTH_TOKEN");
  return value;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: Record<string, unknown>): string {
  const encoded = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySignedPayload(token: string): Record<string, any> | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function isTrustedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "chatgpt.com" ||
      url.hostname.endsWith(".chatgpt.com") ||
      url.hostname === "openai.com" ||
      url.hostname.endsWith(".openai.com")
    );
  } catch {
    return false;
  }
}

function verifyClientId(clientId: string, redirectUri?: string): boolean {
  const payload = verifySignedPayload(clientId);
  if (!payload || payload.kind !== "client" || !Array.isArray(payload.redirect_uris)) return false;
  return !redirectUri || payload.redirect_uris.includes(redirectUri);
}

function verifyAccessToken(authorizationHeader: string | undefined): Record<string, any> | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const payload = verifySignedPayload(token);
  if (
    !payload ||
    payload.kind !== "access" ||
    payload.aud !== resourceId ||
    typeof payload.scope !== "string"
  ) return null;
  return payload;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(secret()).digest();
}

function encryptConnection(value: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptConnection(value: string | undefined): Record<string, any> | null {
  if (!value) return null;
  const [ivText, tagText, dataText] = value.split(".");
  if (!ivText || !tagText || !dataText) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}

function notionOauthConfigured(): boolean {
  return Boolean(process.env.NOTION_OAUTH_CLIENT_ID && process.env.NOTION_OAUTH_CLIENT_SECRET);
}

function notionRedirectUri(): string {
  return `${publicOrigin}/oauth/notion/callback`;
}

function supabaseOauthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.ARTIST_OS_APP_URL);
}

function artistOsAppUrl(): string {
  const value = process.env.ARTIST_OS_APP_URL;
  if (!value) throw new Error("Missing required environment variable: ARTIST_OS_APP_URL");
  return value.replace(/\/$/, "");
}

async function redeemArtistOsTicket(ticket: string, state: string): Promise<SupabaseConnection> {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("Supabase OAuth bridge is not configured.");
  const response = await fetch(`${base}/functions/v1/mcp-connection-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "redeem", ticket, state }),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body?.connection_token || !body?.workspace_id || !body?.user_id) {
    throw new Error("Artist OS connection ticket is invalid or expired.");
  }
  return {
    connectionToken: body.connection_token,
    userId: body.user_id,
    workspaceId: body.workspace_id,
    role: body.role,
    connectionExpiresAt: body.connection_expires_at,
  };
}

function writeJson(res: any, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function authorizationPage(params: URLSearchParams, error?: string): string {
  const hidden = [
    "response_type",
    "client_id",
    "redirect_uri",
    "code_challenge",
    "code_challenge_method",
    "state",
    "scope",
    "resource",
  ]
    .map((name) => {
      const value = params.get(name) ?? "";
      return `<input type="hidden" name="${name}" value="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Independent Artist OS</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:8vh auto;padding:24px;color:#171717}
    .card{border:1px solid #ddd;border-radius:16px;padding:24px}
    input{width:100%;box-sizing:border-box;padding:12px;margin:12px 0 16px;border:1px solid #bbb;border-radius:10px}
    button{padding:12px 18px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:600;cursor:pointer}
    .muted{color:#666}.error{color:#b42318}
  </style>
</head>
<body>
  <div class="card">
    <h1>Independent Artist OS</h1>
    <p>Authorize ChatGPT to access your private Artist OS MCP server.</p>
    <p class="muted">Use the value stored in Render as <code>MCP_AUTH_TOKEN</code>. It is never sent to ChatGPT.</p>
    ${error ? `<p class="error">${error}</p>` : ""}
    <form method="post" action="/oauth/authorize">
      ${hidden}
      <label for="access_key">Artist OS access key</label>
      <input id="access_key" name="access_key" type="password" autocomplete="current-password" required>
      <button type="submit">Authorize ChatGPT</button>
    </form>
  </div>
</body>
</html>`;
}

function createMusicOsServer(authPayload: Record<string, any> = {}) {
  const connection = decryptConnection(authPayload.conn);
  const isSupabase = connection?.provider === "supabase_gateway";
  const adapter = isSupabase
    ? new SupabaseAdapter(connection as SupabaseConnection)
    : connection?.token
      ? new NotionAdapter({ token: connection.token })
      : new NotionAdapter();
  const currentArtistId = () =>
    isSupabase
      ? String(connection?.workspaceId ?? "")
      : (typeof authPayload.sub === "string" && authPayload.sub) ||
        process.env.MUSIC_OS_ARTIST_ID ||
        "default";
  const server = new McpServer({
    name: "independent-artist-os",
    version: "0.3.0",
  });

  registerAppResource(
    server,
    "artist-os-dashboard",
    "ui://artist-os/dashboard.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://artist-os/dashboard.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: dashboardHtml,
          _meta: {
            ui: { prefersBorder: true },
            "openai/widgetDescription":
              "Artist OS management dashboard with 90-day goal, weekly priorities, bottleneck and open tasks.",
          },
        },
      ],
    }),
  );

  server.tool(
    "get_artist_context",
    "Read the live Artist Master Context for the current artist.",
    {},
    async () => asText(await adapter.getArtistContext(currentArtistId())),
  );

  registerAppTool(
    server,
    "get_operating_snapshot",
    {
      title: "Open Artist OS",
      description:
        "Read the artist's current management snapshot: Artist Context, active projects, open tasks and runtime controls.",
      inputSchema: {},
      outputSchema: {
        snapshot: z.object({
          artist: z.object({
            artistId: z.string(),
            artistName: z.string().optional(),
            stage: z.string().optional(),
            twelveMonthObjective: z.string().optional(),
            ninetyDayGoal: z.string().optional(),
            weeklyTop3: z.array(z.string()),
            currentBottleneck: z.string().optional(),
            nextImportantDate: z.string().optional(),
            source: z.string(),
            rawText: z.string().optional(),
          }),
          activeProjects: z.array(z.any()),
          openTasks: z.array(z.any()),
          runtime: z.object({
            mode: z.enum(["PAUSED", "SUPERVISED", "ACTIVE"]),
            externalActions: z.enum(["BLOCKED", "APPROVAL_ONLY", "ALLOWED"]),
          }),
        }),
      },
      _meta: {
        ui: { resourceUri: "ui://artist-os/dashboard.html" },
      },
    },
    async () => {
      const snapshot = await adapter.getOperatingSnapshot(currentArtistId());
      return {
        content: [{ type: "text" as const, text: "Opened the Artist OS management snapshot." }],
        structuredContent: { snapshot },
      };
    },
  );

  server.tool(
    "create_task",
    "Create an internal Music OS task. This never performs the external action represented by the task.",
    {
      task: z.string().min(1),
      nextAction: z.string().min(1),
      priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
      dueDate: z.string().optional(),
      sourceAgent: z.string().min(1),
      projectId: z.string().optional(),
      approvalState: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).optional(),
      agentRunId: z.string().optional(),
    },
    async (input) => {
      assertInternalWriteAllowed();
      return asText(await adapter.createTask({ artistId: currentArtistId(), ...input }));
    },
  );

  server.tool(
    "update_task",
    "Update an existing internal Music OS task.",
    {
      taskId: z.string().min(1),
      status: z.enum(["Not Started", "In Progress", "Waiting", "Done"]).optional(),
      priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
      dueDate: z.string().optional(),
      nextAction: z.string().optional(),
      approvalState: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).optional(),
      agentRunId: z.string().optional(),
    },
    async (input) => {
      assertInternalWriteAllowed();
      return asText(await adapter.updateTask({ artistId: currentArtistId(), ...input }));
    },
  );

  server.tool(
    "request_approval",
    "Stage a consequential action for explicit human approval. This tool never executes the external action.",
    {
      actionType: z.string().min(1),
      summary: z.string().min(1),
      relatedObject: z.string().optional(),
      sourceAgent: z.string().min(1),
    },
    async (input) => {
      assertExternalActionMayBeStaged();
      const fingerprint = actionFingerprint({
        artistId: currentArtistId(),
        actionType: input.actionType,
        summary: input.summary,
        relatedObject: input.relatedObject ?? null,
      });
      return asText(
        await adapter.requestApproval({
          artistId: currentArtistId(),
          ...input,
          actionFingerprint: fingerprint,
        }),
      );
    },
  );

  server.tool(
    "log_agent_run",
    "Write an auditable Automation Runs entry.",
    {
      runId: z.string().optional(),
      sourceAgent: z.string().min(1),
      trigger: z.string().min(1),
      state: z.enum(["Started", "Waiting Approval", "Succeeded", "Failed", "Retryable", "Aborted"]),
      approvalState: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).optional(),
      actionFingerprint: z.string().optional(),
      relatedObject: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => {
      assertInternalWriteAllowed();
      const runId = input.runId ?? randomUUID();
      return asText(await adapter.logAgentRun({ artistId: currentArtistId(), ...input, runId }));
    },
  );


  if (!isSupabase) {
    const notionAdapter = adapter as NotionAdapter;
    server.tool(
    "get_workflow",
    "Read one active Master Workflow definition by workflow ID.",
    {
      workflowId: z.string().regex(/^MW-\\d{2}$/),
    },
    async ({ workflowId }) => asText(await notionAdapter.getWorkflow(workflowId)),
  );

    server.tool(
    "route_workflow",
    "Route a plain-language management intent to the most relevant active Master Workflow. This returns a recommendation only and does not start execution.",
    {
      intent: z.string().min(1),
    },
    async ({ intent }) => {
      const workflows = await notionAdapter.listWorkflows();
      const normalized = intent.toLowerCase();
      const keywordMap: Array<[string[], string]> = [
        [["onboard", "new artist", "activation"], "MW-01"],
        [["this week", "weekly", "help me grow", "priorit"], "MW-02"],
        [["90 day", "90-day", "quarter", "strategy cycle"], "MW-03"],
        [["demo", "catalog", "music pipeline", "which track"], "MW-04"],
        [["release ready", "release readiness", "can i release", "release setup"], "MW-05"],
        [["dj promo", "radio promo", "promote my track", "tastemaker", "send track"], "MW-06"],
        [["release campaign", "campaign my release"], "MW-07"],
        [["content", "reel", "video", "post", "asset"], "MW-08"],
        [["growth test", "experiment", "ads", "acquisition"], "MW-09"],
        [["fan crm", "fan capture", "newsletter", "owned audience"], "MW-10"],
        [["booking outreach", "more shows", "bookings", "promoter", "venue"], "MW-11"],
        [["booking inquiry", "offer", "booking request"], "MW-12"],
        [["advance show", "advancing", "hotel", "rider", "travel"], "MW-13"],
        [["relationship", "crm follow up", "industry crm"], "MW-14"],
        [["label outreach", "publisher", "brand outreach", "industry outreach"], "MW-15"],
        [["revenue", "monetization", "income"], "MW-16"],
        [["finance", "cash", "receivable", "budget review"], "MW-17"],
        [["rights", "splits", "publishing", "ownership", "agreement"], "MW-18"],
        [["performance", "postmortem", "how did", "learning"], "MW-19"],
        [["hygiene", "data quality", "stale", "duplicate", "what is wrong"], "MW-20"],
      ];
      const match = keywordMap.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
      const selected = match
        ? workflows.find((workflow) => workflow.workflowId === match[1])
        : workflows.find((workflow) => workflow.workflowId === "MW-02");
      if (!selected) throw new Error("No active workflow available for routing.");
      return asText({
        workflowId: selected.workflowId,
        name: selected.name,
        reason: match ? "Matched management intent to workflow trigger." : "Defaulted to Weekly Artist Management for diagnosis and routing.",
      });
    },
  );

    server.tool(
    "start_workflow",
    "Start a persistent Master Workflow run for the current artist. Creates runtime state in Workflow Runs; it does not perform external actions.",
    {
      workflowId: z.string().regex(/^MW-\\d{2}$/),
      trigger: z.string().min(1),
      relatedObject: z.string().optional(),
      contextSnapshot: z.string().optional(),
    },
    async (input) => {
      assertInternalWriteAllowed();
      const snapshot = input.contextSnapshot ?? JSON.stringify(await notionAdapter.getOperatingSnapshot(currentArtistId()));
      return asText(
        await notionAdapter.startWorkflow({
          artistId: currentArtistId(),
          ...input,
          contextSnapshot: snapshot,
        }),
      );
    },
  );

    server.tool(
    "get_workflow_run",
    "Read the current state of a persistent Master Workflow run.",
    {
      runId: z.string().min(1),
    },
    async ({ runId }) => asText(await notionAdapter.getWorkflowRun(runId)),
  );

    server.tool(
    "advance_workflow",
    "Advance or update a persistent Master Workflow run. This changes only internal workflow state; external actions still require the normal approval tools.",
    {
      runId: z.string().min(1),
      state: z.enum([
        "NOT_STARTED",
        "CONTEXT_CHECK",
        "READY",
        "RUNNING",
        "WAITING_FOR_DATA",
        "WAITING_FOR_APPROVAL",
        "EXECUTING",
        "MEASURING",
        "COMPLETED",
        "BLOCKED",
      ]).optional(),
      currentStep: z.string().optional(),
      approvalState: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).optional(),
      blockedReason: z.string().optional(),
      nextAction: z.string().optional(),
      result: z.string().optional(),
    },
    async (input) => {
      assertInternalWriteAllowed();
      return asText(await notionAdapter.advanceWorkflow({ artistId: currentArtistId(), ...input }));
    },
  );

  }

  if (isSupabase) {
    const supabase = adapter as SupabaseAdapter;

    server.tool(
      "get_recent_changes",
      "Read incremental Second Brain changes after a workspace version cursor.",
      {
        afterVersion: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(200).default(50),
      },
      async ({ afterVersion, limit }) => asText(await supabase.getRecentChanges(afterVersion, limit)),
    );

    server.tool(
      "list_tasks",
      "List tasks for the connected Artist OS workspace.",
      {
        includeDone: z.boolean().default(false),
      },
      async ({ includeDone }) => asText(await supabase.listTasks(currentArtistId(), includeDone)),
    );

    server.tool(
      "search_contacts",
      "Search the connected Artist OS CRM by name, email, city or country.",
      {
        query: z.string().default(""),
        limit: z.number().int().min(1).max(100).default(25),
      },
      async ({ query, limit }) => asText(await supabase.searchContacts(query, limit)),
    );

    server.tool(
      "get_contact",
      "Read one CRM contact with roles, organizations and recent interactions.",
      {
        contactId: z.string().uuid(),
      },
      async ({ contactId }) => asText(await supabase.getContact(contactId)),
    );

    server.tool(
      "create_contact",
      "Create a CRM contact in the connected Artist OS workspace. This is an internal Second Brain write only.",
      {
        display_name: z.string().min(1),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email_primary: z.string().email().optional(),
        email_secondary: z.string().email().optional(),
        phone_primary: z.string().optional(),
        phone_secondary: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        instagram_or_social: z.string().optional(),
        website: z.string().optional(),
        preferred_channel: z.string().optional(),
        notes: z.string().optional(),
        source_reference: z.string().max(200).optional(),
        last_contact_at: z.string().optional(),
        next_follow_up_at: z.string().optional(),
      },
      async (input) => {
        assertInternalWriteAllowed();
        return asText(await supabase.createContact(input));
      },
    );

    server.tool(
      "update_contact",
      "Update safe CRM fields for an existing contact in the connected workspace.",
      {
        contactId: z.string().uuid(),
        display_name: z.string().min(1).optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email_primary: z.string().email().nullable().optional(),
        email_secondary: z.string().email().nullable().optional(),
        phone_primary: z.string().nullable().optional(),
        phone_secondary: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        language: z.string().nullable().optional(),
        instagram_or_social: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
        preferred_channel: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        last_contact_at: z.string().nullable().optional(),
        next_follow_up_at: z.string().nullable().optional(),
        archived_at: z.string().nullable().optional(),
      },
      async ({ contactId, ...payload }) => {
        assertInternalWriteAllowed();
        return asText(await supabase.updateContact(contactId, payload));
      },
    );

    server.tool(
      "log_interaction",
      "Log an internal CRM interaction and optional next action. This does not send a message.",
      {
        contact_id: z.string().uuid().optional(),
        organization_id: z.string().uuid().optional(),
        interaction_type: z.enum(["email","dm","call","meeting","show","feedback","support","note","other"]).default("note"),
        occurred_at: z.string().optional(),
        summary: z.string().min(1),
        outcome: z.string().optional(),
        next_action: z.string().optional(),
        next_action_due_at: z.string().optional(),
        project_id: z.string().uuid().optional(),
        task_id: z.string().uuid().optional(),
        source_reference: z.string().max(200).optional(),
      },
      async (input) => {
        assertInternalWriteAllowed();
        return asText(await supabase.logInteraction(input));
      },
    );

    server.tool(
      "search_opportunities",
      "Search CRM opportunities for the connected Artist OS workspace.",
      {
        query: z.string().default(""),
        status: z.string().default("open"),
        limit: z.number().int().min(1).max(100).default(25),
      },
      async ({ query, status, limit }) => asText(await supabase.searchOpportunities(query, status, limit)),
    );

    server.tool(
      "create_opportunity",
      "Create an internal CRM opportunity. This never performs the external opportunity action.",
      {
        opportunity_type: z.enum(["booking","pr","radio","dj_support","collaboration","brand","label","sync","press","other"]),
        title: z.string().min(1),
        contact_id: z.string().uuid().optional(),
        organization_id: z.string().uuid().optional(),
        stage: z.string().optional(),
        status: z.enum(["open","won","lost","on_hold"]).optional(),
        priority: z.enum(["A","B","C","Unscored"]).optional(),
        market_city: z.string().optional(),
        market_country: z.string().optional(),
        value_amount: z.number().optional(),
        value_currency: z.string().optional(),
        date_window_start: z.string().optional(),
        date_window_end: z.string().optional(),
        next_action: z.string().optional(),
        next_action_due_at: z.string().optional(),
        project_id: z.string().uuid().optional(),
        notes: z.string().optional(),
        source_reference: z.string().max(200).optional(),
      },
      async (input) => {
        assertInternalWriteAllowed();
        return asText(await supabase.createOpportunity(input));
      },
    );

    server.tool(
      "update_weekly_priorities",
      "Replace the connected artist's weekly top priorities (maximum three).",
      {
        priorities: z.array(z.string().min(1)).max(3),
      },
      async ({ priorities }) => {
        assertInternalWriteAllowed();
        return asText(await supabase.updateWeeklyPriorities(priorities));
      },
    );

    server.tool(
      "get_discovery_status",
      "Read discovery/onboarding completion counts for the connected artist.",
      {},
      async () => asText(await supabase.getDiscoveryStatus()),
    );
  }

  if (isSupabase) {
    const supabase = adapter as SupabaseAdapter;

    server.tool(
      "get_second_brain_context",
      "Read the normalized BYD Second Brain context for the connected artist, including positioning, facts, goals, tasks, approvals, learnings, decisions, runtime control and AI provider preference.",
      {},
      async () => asText(await supabase.getSecondBrainContext()),
    );

    server.tool(
      "get_system_health",
      "Read operational health for the connected artist workspace, including runtime state, queue counts, knowledge coverage and provider connection metadata.",
      {},
      async () => asText(await supabase.getSystemHealth()),
    );

    server.tool(
      "get_positioning_summary",
      "Read the latest AI Artist Positioning identity and strategic analysis summary for the connected artist.",
      {},
      async () => asText(await supabase.getPositioningSummary()),
    );

    server.tool(
      "get_research_status",
      "Read the latest AI Artist Positioning research run status, source counts, conflicts and missing critical input counts.",
      {},
      async () => asText(await supabase.getResearchStatus()),
    );

    server.tool(
      "get_research_findings",
      "Read source-backed AI Artist Positioning findings, optionally filtered by research domain.",
      {
        domain: z.string().max(40).optional(),
      },
      async ({ domain }) => asText(await supabase.getResearchFindings(domain)),
    );

    server.tool(
      "get_onboarding_prefill_summary",
      "Read AI Artist Positioning prefill coverage for the artist's active delivery package: auto-researched, AI suggestions, artist-only input and conflicts.",
      {},
      async () => asText(await supabase.getOnboardingPrefillSummary()),
    );

    server.tool(
      "list_ai_agents",
      "List active BYD AI agents and their operating domains and permissions.",
      {},
      async () => asText(await supabase.listAiAgents()),
    );

    server.tool(
      "list_workflows",
      "List active BYD workflow definitions, triggers, routing domains and approval policies.",
      {},
      async () => asText(await supabase.listWorkflows()),
    );
  }

  server.tool(
    "get_runtime_control",
    "Read current runtime mode and external-action policy.",
    {},
    async () => asText(getRuntimeControl()),
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Independent Artist OS MCP server");
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
    writeJson(res, 200, {
      resource: resourceId,
      authorization_servers: [oauthIssuer],
      scopes_supported: ["artist_os:read", "artist_os:write", "offline_access"],
      resource_documentation: `${publicOrigin}/`,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
    writeJson(res, 200, {
      issuer: oauthIssuer,
      authorization_endpoint: `${publicOrigin}/oauth/authorize`,
      token_endpoint: `${publicOrigin}/oauth/token`,
      registration_endpoint: `${publicOrigin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["artist_os:read", "artist_os:write", "offline_access"],
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/oauth/register") {
    try {
      const body = JSON.parse(await readBody(req));
      const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((x: unknown) => typeof x === "string") : [];
      if (!redirectUris.length || !redirectUris.every(isTrustedRedirectUri)) {
        writeJson(res, 400, { error: "invalid_redirect_uri" });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const clientId = signPayload({
        kind: "client",
        redirect_uris: redirectUris,
        iat: now,
        exp: now + 60 * 60 * 24 * 30,
      });
      writeJson(res, 201, {
        client_id: clientId,
        client_id_issued_at: now,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      });
    } catch {
      writeJson(res, 400, { error: "invalid_client_metadata" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/oauth/authorize") {
    const responseType = url.searchParams.get("response_type");
    const clientId = url.searchParams.get("client_id") ?? "";
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const challenge = url.searchParams.get("code_challenge") ?? "";
    const method = url.searchParams.get("code_challenge_method");
    const resource = url.searchParams.get("resource");

    if (
      responseType !== "code" ||
      method !== "S256" ||
      !challenge ||
      !verifyClientId(clientId, redirectUri) ||
      !isTrustedRedirectUri(redirectUri) ||
      resource !== resourceId
    ) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Invalid OAuth authorization request.");
      return;
    }

    if (supabaseOauthConfigured()) {
      const now = Math.floor(Date.now() / 1000);
      const state = signPayload({
        kind: "supabase_state",
        request: Object.fromEntries(url.searchParams.entries()),
        iat: now,
        exp: now + 600,
      });
      const target = new URL(artistOsAppUrl() + "/mcp-connect");
      target.searchParams.set("state", state);
      res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
      res.end();
      return;
    }

    if (notionOauthConfigured()) {
      const now = Math.floor(Date.now() / 1000);
      const state = signPayload({
        kind: "notion_state",
        request: Object.fromEntries(url.searchParams.entries()),
        iat: now,
        exp: now + 600,
      });
      const target = new URL("https://api.notion.com/v1/oauth/authorize");
      target.searchParams.set("client_id", process.env.NOTION_OAUTH_CLIENT_ID!);
      target.searchParams.set("response_type", "code");
      target.searchParams.set("owner", "user");
      target.searchParams.set("redirect_uri", notionRedirectUri());
      target.searchParams.set("state", state);
      res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
      res.end();
      return;
    }

    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(authorizationPage(url.searchParams));
    return;
  }

  if (req.method === "POST" && url.pathname === "/oauth/supabase/callback") {
    try {
      const body = new URLSearchParams(await readBody(req));
      const state = body.get("state") ?? "";
      const ticket = body.get("ticket") ?? "";
      const statePayload = verifySignedPayload(state);
      const request = statePayload?.kind === "supabase_state" ? statePayload.request : null;
      if (!request || typeof request !== "object" || !ticket || !supabaseOauthConfigured()) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid Artist OS connection callback.");
        return;
      }

      const connection = await redeemArtistOsTicket(ticket, state);
      const params = new URLSearchParams(
        Object.entries(request).map(([key, value]) => [key, String(value ?? "")]),
      );
      const clientId = params.get("client_id") ?? "";
      const redirectUri = params.get("redirect_uri") ?? "";
      const codeChallenge = params.get("code_challenge") ?? "";
      const stateBack = params.get("state") ?? "";
      const scope = params.get("scope") ?? "artist_os:read artist_os:write";
      const resource = params.get("resource") ?? "";
      if (
        params.get("response_type") !== "code" ||
        params.get("code_challenge_method") !== "S256" ||
        !codeChallenge ||
        !verifyClientId(clientId, redirectUri) ||
        !isTrustedRedirectUri(redirectUri) ||
        resource !== resourceId
      ) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid original ChatGPT OAuth request.");
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const encrypted = encryptConnection({ provider: "supabase_gateway", ...connection });
      const authCode = signPayload({
        kind: "auth_code",
        nonce: randomUUID(),
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        resource,
        scope,
        sub: connection.userId,
        conn: encrypted,
        iat: now,
        exp: now + 300,
      });

      const target = new URL(redirectUri);
      target.searchParams.set("code", authCode);
      if (stateBack) target.searchParams.set("state", stateBack);
      res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
      res.end();
    } catch (error) {
      console.error("Artist OS connection callback failed:", error);
      res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
      res.end("Could not connect this Artist OS workspace.");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/oauth/notion/callback") {
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const statePayload = verifySignedPayload(state);
    const request = statePayload?.kind === "notion_state" ? statePayload.request : null;

    if (!code || !request || typeof request !== "object" || !notionOauthConfigured()) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Invalid Notion OAuth callback.");
      return;
    }

    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.NOTION_OAUTH_CLIENT_ID + ":" + process.env.NOTION_OAUTH_CLIENT_SECRET,
          ).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: notionRedirectUri(),
      }),
    });

    if (!tokenResponse.ok) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("Notion authorization failed.");
      return;
    }

    const notion: any = await tokenResponse.json();
    if (!notion.access_token || !notion.workspace_id) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("Notion returned an incomplete authorization response.");
      return;
    }

    const params = new URLSearchParams(
      Object.entries(request).map(([key, value]) => [key, String(value ?? "")]),
    );
    const clientId = params.get("client_id") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const codeChallenge = params.get("code_challenge") ?? "";
    const stateBack = params.get("state") ?? "";
    const scope = params.get("scope") ?? "artist_os:read artist_os:write";
    const resource = params.get("resource") ?? "";

    if (
      params.get("response_type") !== "code" ||
      params.get("code_challenge_method") !== "S256" ||
      !codeChallenge ||
      !verifyClientId(clientId, redirectUri) ||
      !isTrustedRedirectUri(redirectUri) ||
      resource !== resourceId
    ) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Invalid original ChatGPT OAuth request.");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const connection = encryptConnection({
      token: notion.access_token,
      workspaceId: notion.workspace_id,
      workspaceName: notion.workspace_name,
      botId: notion.bot_id,
      duplicatedTemplateId: notion.duplicated_template_id,
    });
    const authCode = signPayload({
      kind: "auth_code",
      nonce: randomUUID(),
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      resource,
      scope,
      sub: notion.workspace_id,
      conn: connection,
      iat: now,
      exp: now + 300,
    });

    const target = new URL(redirectUri);
    target.searchParams.set("code", authCode);
    if (stateBack) target.searchParams.set("state", stateBack);
    res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/oauth/authorize") {
    const body = new URLSearchParams(await readBody(req));
    const accessKey = body.get("access_key") ?? "";
    const expected = secret();
    const a = Buffer.from(accessKey);
    const b = Buffer.from(expected);
    const validKey = a.length === b.length && timingSafeEqual(a, b);

    const clientId = body.get("client_id") ?? "";
    const redirectUri = body.get("redirect_uri") ?? "";
    const codeChallenge = body.get("code_challenge") ?? "";
    const state = body.get("state") ?? "";
    const scope = body.get("scope") ?? "artist_os:read artist_os:write";
    const resource = body.get("resource") ?? "";

    if (
      !validKey ||
      body.get("response_type") !== "code" ||
      body.get("code_challenge_method") !== "S256" ||
      !verifyClientId(clientId, redirectUri) ||
      !isTrustedRedirectUri(redirectUri) ||
      resource !== resourceId
    ) {
      res.writeHead(401, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(authorizationPage(body, "Invalid access key or OAuth request."));
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    const code = signPayload({
      kind: "auth_code",
      nonce,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      resource,
      scope,
      iat: now,
      exp: now + 300,
    });

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/oauth/token") {
    const body = new URLSearchParams(await readBody(req));
    const grantType = body.get("grant_type");

    if (grantType === "authorization_code") {
      const code = body.get("code") ?? "";
      const codeVerifier = body.get("code_verifier") ?? "";
      const redirectUri = body.get("redirect_uri") ?? "";
      const clientId = body.get("client_id") ?? "";
      const payload = verifySignedPayload(code);

      if (
        !payload ||
        payload.kind !== "auth_code" ||
        usedAuthorizationCodes.has(payload.nonce) ||
        payload.client_id !== clientId ||
        payload.redirect_uri !== redirectUri ||
        !verifyClientId(clientId, redirectUri)
      ) {
        writeJson(res, 400, { error: "invalid_grant" });
        return;
      }

      const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
      if (challenge !== payload.code_challenge) {
        writeJson(res, 400, { error: "invalid_grant" });
        return;
      }

      usedAuthorizationCodes.add(payload.nonce);
      const now = Math.floor(Date.now() / 1000);
      const accessToken = signPayload({
        kind: "access",
        aud: resourceId,
        scope: payload.scope,
        sub: payload.sub ?? "artist-os-owner",
        conn: payload.conn,
        iat: now,
        exp: now + 3600,
      });
      const refreshToken = signPayload({
        kind: "refresh",
        aud: resourceId,
        scope: payload.scope,
        sub: payload.sub ?? "artist-os-owner",
        conn: payload.conn,
        iat: now,
        exp: now + 60 * 60 * 24 * 30,
      });
      writeJson(res, 200, {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: payload.scope,
      });
      return;
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.get("refresh_token") ?? "";
      const payload = verifySignedPayload(refreshToken);
      if (!payload || payload.kind !== "refresh" || payload.aud !== resourceId) {
        writeJson(res, 400, { error: "invalid_grant" });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const connectionToken = payload.conn;
      const accessToken = signPayload({
        kind: "access",
        aud: resourceId,
        scope: payload.scope,
        sub: payload.sub,
        conn: connectionToken,
        iat: now,
        exp: now + 3600,
      });
      writeJson(res, 200, {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: payload.scope,
      });
      return;
    }

    writeJson(res, 400, { error: "unsupported_grant_type" });
    return;
  }

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  const allowedMethods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && allowedMethods.has(req.method)) {
    if (!process.env.MCP_AUTH_TOKEN) {
      writeJson(res, 503, { error: "MCP authentication is not configured" });
      return;
    }

    const authPayload = verifyAccessToken(req.headers.authorization);
    if (!authPayload) {
      writeJson(
        res,
        401,
        { error: "Unauthorized" },
        {
          "WWW-Authenticate":
            `Bearer resource_metadata="${publicOrigin}/.well-known/oauth-protected-resource", scope="artist_os:read artist_os:write"`,
        },
      );
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createMusicOsServer(authPayload);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Independent Artist OS MCP listening on http://localhost:${port}${MCP_PATH}`);
  console.log("OAuth config status", {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    artistOsAppUrl: Boolean(process.env.ARTIST_OS_APP_URL),
    notionClientId: Boolean(process.env.NOTION_OAUTH_CLIENT_ID),
    notionClientSecret: Boolean(process.env.NOTION_OAUTH_CLIENT_SECRET),
  });
});
