# Independent Artist OS — Notion MCP connector

A Notion-only MCP connector for **multiple independent artists**. It supports an ACL-scoped shared Notion workspace for artist context and internal tasks, as well as a separate legacy workspace adapter. No additional UI, database backend, or AI worker is required.

## Architecture

- ChatGPT connects to the MCP server using OAuth 2.0 + PKCE.
- The server redirects each connection to **Notion OAuth**.
- Each authenticated connection is bound to its own Notion workspace and access token. There is no global fallback Notion token.
- Reads and governed internal writes go directly to Notion through the existing adapter.
- For multiple artists in one Notion workspace, configure the shared-workspace databases and a server-side OAuth-owner/artist ACL. Artist-specific calls require an authorized Artist Master Context page ID.

See [Monthly Artist Growth Flywheel](docs/MONTHLY_ARTIST_GROWTH_FLYWHEEL.md) for the release → data → content → Meta Ads → growth → PR/promoters → bookings → revenue → forecast cycle. Its 10 reusable task templates are stored in Notion `Management Tasks` without artist ownership; operational tasks must be materialized per authorized artist. See [mcp/README.md](mcp/README.md) for shared-workspace setup and [SECURITY.md](SECURITY.md) for isolation boundaries.

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
