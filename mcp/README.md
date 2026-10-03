# Music OS MCP Server

Governed runtime bridge between ChatGPT and Beyond Artist OS.

## Primary architecture

The live multi-tenant backend is Supabase/Postgres. Each ChatGPT OAuth connection is bound to:
- one authenticated Supabase user;
- one selected Artist OS workspace;
- the user's existing workspace role.

The MCP server never chooses an artist by a shared environment variable in the multi-tenant flow. It forwards the user's Supabase JWT to PostgREST/RPC, so Row Level Security remains authoritative.

Legacy Notion support is still present only as a migration/fallback adapter.

## Core tools

Read:
- `get_artist_context`
- `get_operating_snapshot`
- `get_recent_changes`
- `list_tasks`
- `search_contacts`
- `get_contact`
- `search_opportunities`
- `get_discovery_status`
- `get_runtime_control`

Controlled internal writes:
- `create_task`
- `update_task`
- `create_contact`
- `update_contact`
- `log_interaction`
- `create_opportunity`
- `update_weekly_priorities`
- `request_approval`
- `log_agent_run`

External execution is not implemented.

## Incremental Second Brain sync

`get_recent_changes(afterVersion)` reads the workspace activity/version feed.

The client should keep the returned `current_version` as its cursor. On the next conversation it requests only events after the previous cursor. Entity state can then be re-read by ID when needed.

## OAuth flow

1. ChatGPT starts OAuth at the MCP server.
2. MCP redirects to `ARTIST_OS_APP_URL/mcp-connect`.
3. The user signs into Beyond Artist OS if needed and selects a workspace.
4. The app POSTs the current Supabase access/refresh tokens and selected workspace ID to the fixed MCP callback.
5. MCP verifies the user against Supabase Auth and verifies membership in the selected workspace.
6. The encrypted connection is embedded in the MCP OAuth token.
7. On MCP refresh-token use, the server refreshes the underlying Supabase session as well.

Supabase tokens are never placed in query strings.

## Safety model

- `PAUSED` disables internal writes.
- External actions can only be staged when runtime controls permit it.
- `request_approval` creates a pending approval record; it never executes the external action.
- MCP writes use narrow `mcp_*` database RPCs with explicit allowlists and workspace checks.
- Activity created through those RPCs is attributed to `source_type='mcp'`.
- No payment, contract, rights, publishing, distributor, ad-spend, content-publish or outbound-message execution tools exist.

## Required runtime variables

See `.env.example`. For the primary multi-tenant flow:
- `MCP_AUTH_TOKEN`
- `MCP_PUBLIC_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ARTIST_OS_APP_URL`
- `MUSIC_OS_RUNTIME_MODE`
- `MUSIC_OS_EXTERNAL_ACTIONS`

## Run locally

```bash
cd mcp
npm install
npm run typecheck
npm run build
npm start
```

Never commit real credentials.
