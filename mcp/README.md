# Notion-only multi-artist MCP server

This Node.js 22 / TypeScript server exposes Streamable HTTP MCP at `/mcp`. It has **one external service integration: Notion**.

## Connect a Notion artist

1. Register a public OAuth integration in Notion and set its redirect URI to `https://YOUR_MCP_HOST/oauth/notion/callback`.
2. Configure the four variables in [`.env.example`](.env.example) on the server.
3. Share the artist's Notion pages/databases with the integration.
4. Add `https://YOUR_MCP_HOST/mcp` as an MCP connection in ChatGPT. The OAuth flow redirects to Notion to grant access.
5. Repeat the authorization with a **different Notion workspace** for each independent artist. Different connections retain separate encrypted tokens and workspace IDs.

The connector auto-discovers the `Artist Master Context` (or `Command Center`) page and the `Projects`, `Tasks`, `Automation Runs`, `Workflow Registry` and `Workflow Runs` databases, using the authenticated workspace's Notion visibility. Give resources unambiguous names. Missing or ambiguous required resources cause the connection's operations to fail closed.

One Notion workspace is treated as one artist tenant. Multiple artists within a single Notion workspace, workspace-level shared databases, or multiple deployments sharing an in-memory OAuth code replay store are **not** supported as isolated artist tenants. Separate Notion workspaces are required for actual isolation. Legacy connections need to be removed from ChatGPT and reauthorized through Notion.

## Available operations

Read artist context/snapshot, get runtime control, create/update internal tasks, stage human approvals as tasks, log agent runs, and read/route/start/advance Notion master workflows. No external payment, contract, publishing, social, email, distributor or ad-spend execution.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | Strong random signing/encryption secret, identical across restarts |
| `MCP_PUBLIC_URL` | Public HTTPS origin of this MCP server |
| `NOTION_OAUTH_CLIENT_ID` | Notion public OAuth integration ID |
| `NOTION_OAUTH_CLIENT_SECRET` | Notion OAuth integration client secret |
| `MUSIC_OS_RUNTIME_MODE` | `SUPERVISED` by default |
| `MUSIC_OS_EXTERNAL_ACTIONS` | `APPROVAL_ONLY` by default |

Never set `NOTION_TOKEN` as a global runtime fallback in a multi-artist deployment. No additional backend variables are used. `npm start` reads the process environment; it does not automatically load .env files.

## Run checks

```sh
npm ci
npm test
npm run typecheck
npm run build
npm start
```

`GET /health` confirms process readiness, not Notion authorization or Notion API availability. OAuth authorization codes are consumed in process memory; **run exactly one instance** until a durable replay store is implemented. The service does not auto-deploy. Follow [go-live checks](../docs/GO_LIVE.md).
