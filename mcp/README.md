# Music OS MCP Server

Governed runtime bridge between Independent Artist OS agents and live artist state.

## v0.1 tools

- `get_artist_context`
- `get_operating_snapshot`
- `create_task`
- `update_task`
- `request_approval`
- `log_agent_run`
- `get_runtime_control`

The first backend adapter is Notion. Agents call semantic Music OS tools rather than raw Notion APIs so the backend can later move to Postgres or another system without changing agent behavior.

## Safety model

- `PAUSED` disables internal writes.
- External actions can only be staged when runtime controls permit it.
- `request_approval` creates a pending approval task; it never executes the external action.
- No payment, contract, rights, distributor, publishing or destructive external execution tools exist in v0.1.
- Repository rules in `system/PERMISSIONS.md` and `STEP21_INTEGRATIONS.md` remain authoritative.

## Run locally

```bash
cd mcp
npm install
npm run typecheck
npm run build
npm start
```

Configure values from `.env.example` through the runtime secret store. Do not commit real credentials.

## MCP host configuration

Use the built server through stdio, for example:

```json
{
  "mcpServers": {
    "independent-artist-os": {
      "command": "node",
      "args": ["/absolute/path/to/IndependentArtistOS/mcp/dist/server.js"]
    }
  }
}
```

The host/runtime must inject the Notion token and database/page IDs.

## Next milestones

1. Tenant-aware Artist Connection Registry instead of one environment-bound artist.
2. Server-side `find_equivalent_action` idempotency lookup.
3. Semantic release-readiness/module-context tools.
4. Approval tokens before any external execution tools are added.
5. Authenticated `streamable_http` deployment for hosted ChatGPT use.
6. Sandbox integration tests against a non-production artist workspace.
