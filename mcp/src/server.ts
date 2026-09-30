import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NotionAdapter } from "./adapters/notion.js";
import {
  actionFingerprint,
  assertExternalActionMayBeStaged,
  assertInternalWriteAllowed,
  getRuntimeControl,
} from "./governance.js";

const adapter = new NotionAdapter();
const server = new McpServer({ name: "independent-artist-os", version: "0.1.0" });
const artistId = () => process.env.MUSIC_OS_ARTIST_ID ?? "default";
const asText = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

server.tool("get_artist_context", "Read the live Artist Master Context.", {}, async () =>
  asText(await adapter.getArtistContext(artistId())),
);

server.tool("get_operating_snapshot", "Read Artist Context, active projects, open tasks and runtime controls.", {}, async () =>
  asText(await adapter.getOperatingSnapshot(artistId())),
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
    return asText(await adapter.requestApproval({
      artistId: artistId(),
      ...input,
      actionFingerprint: fingerprint,
    }));
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

server.tool("get_runtime_control", "Read current runtime mode and external-action policy.", {}, async () =>
  asText(getRuntimeControl()),
);

const transport = new StdioServerTransport();
await server.connect(transport);
