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
  const adapter = connection?.token
    ? new NotionAdapter({ token: connection.token })
    : new NotionAdapter();
  const currentArtistId = () =>
    (typeof authPayload.sub === "string" && authPayload.sub) ||
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
      const accessToken = signPayload({
        kind: "access",
        aud: resourceId,
        scope: payload.scope,
        sub: payload.sub,
        conn: payload.conn,
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
});
