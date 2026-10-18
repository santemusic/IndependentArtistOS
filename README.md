# Independent Artist OS — Notion MCP connector

A standalone MCP connector for **multiple independent artists**, each using an authorized Notion workspace. No Lovable UI, Supabase backend, AI worker or other external data system is required.

## Architecture

- ChatGPT connects to the MCP server using OAuth 2.0 + PKCE.
- The server redirects each connection to **Notion OAuth**.
- Each authenticated connection is bound to its own Notion workspace and access token. There is no global fallback Notion token.
- Reads and governed internal writes go directly to Notion through the existing adapter.
- For artists in different Notion workspaces, authorize one MCP connection per workspace. Do not share a connection across unrelated artists.

See [mcp/README.md](mcp/README.md) for setup and expected Notion databases and [SECURITY.md](SECURITY.md) for isolation boundaries.

## Local build

Node.js 22+:

```sh
cd mcp
npm ci
npm test
npm run typecheck
npm run build
npm start
```

Configure `MCP_AUTH_TOKEN`, `MCP_PUBLIC_URL`, `NOTION_OAUTH_CLIENT_ID` and `NOTION_OAUTH_CLIENT_SECRET` using [mcp/.env.example](mcp/.env.example). The process does not automatically load a .env file.

Deployment is described in [render.yaml](render.yaml); automatic deployment is disabled. This repository does not contain Notion workspace content or credentials.
