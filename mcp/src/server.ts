import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { NotionAdapter } from "./adapters/notion.js";
import {
  actionFingerprint,
  assertExternalActionMayBeStaged,
  assertInternalWriteAllowed,
  getRuntimeControl,
} from "./governance.js";

const dashboardHtml = readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");
const MCP_PATH = "/mcp";
const port = Number(process.env.PORT ?? process.env.MUSIC_OS_PORT ?? 8787);

const artistId = () => process.env.MUSIC_OS_ARTIST_ID ?? "default";

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function createMusicOsServer() {
  const adapter = new NotionAdapter();
  const server = new McpServer({
    name: "independent-artist-os",
    version: "0.2.0",
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
    async () => asText(await adapter.getArtistContext(artistId())),
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
      const snapshot = await adapter.getOperatingSnapshot(artistId());
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
      return asText(await adapter.createTask({ artistId: artistId(), ...input }));
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
      return asText(await adapter.updateTask({ artistId: artistId(), ...input }));
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
        artistId: artistId(),
        actionType: input.actionType,
        summary: input.summary,
        relatedObject: input.relatedObject ?? null,
      });
      return asText(
        await adapter.requestApproval({
          artistId: artistId(),
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
      return asText(await adapter.logAgentRun({ artistId: artistId(), ...input, runId }));
    },
  );

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

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  const allowedMethods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && allowedMethods.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createMusicOsServer();
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
});
