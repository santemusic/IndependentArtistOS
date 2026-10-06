# Artist OS MCP server

Node.js 22 / TypeScript service exposing Streamable HTTP at `/mcp` and an embedded dashboard. The root `/` endpoint is a process liveness response, not proof that the backend or AI provider is healthy.

## Primary backend and authentication

1. ChatGPT starts OAuth with this server.
2. The server redirects to `ARTIST_OS_APP_URL/mcp-connect` with signed state.
3. The BYD app authenticates the user and selects their workspace.
4. The app returns a one-time ticket and state to `/oauth/supabase/callback`.
5. The server redeems the ticket through `mcp-connection-ticket` and embeds the encrypted connection in its OAuth tokens.
6. Workspace operations go through `mcp-gateway` using that connection token. Selected Second Brain reads use `mcp_direct_read` with the public API key and connection token.

The backend must validate current membership, token expiry/revocation and workspace access. A workspace ID supplied by a model is never sufficient authorization. This implementation does not forward a user's Supabase JWT or refresh a Supabase user session.

## Operations

The server provides artist context, operating snapshots, tasks, CRM, activity, discovery, Second Brain and runtime information; controlled writes create/update internal records and stage approvals. `run_ai_ceo` currently calls OpenAI directly, validates structured output and writes tasks/approval requests. It is not the queued worker from issue #2.

No external payment, contract, rights, publishing, distributor, ad-spend or outbound-message execution tool is implemented.

The imported Notion adapter and its OAuth/workflow paths remain executable compatibility code. Removing them requires a separate runtime change and regression checks; deleting unused source files would break the build.

## Configuration

See [`.env.example`](.env.example) for the primary flow:

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | Server signing/encryption secret; keep stable across instances |
| `MCP_PUBLIC_URL` | Public service origin |
| `SUPABASE_URL` | Canonical BYD backend URL |
| `SUPABASE_ANON_KEY` | Public key used for direct RPC reads |
| `ARTIST_OS_APP_URL` | BYD app origin for workspace connection |
| `OPENAI_API_KEY` | Server-side key for the synchronous CEO tool |
| `BYD_OPENAI_MODEL` | Model configured by the operator |
| `MUSIC_OS_RUNTIME_MODE` | `PAUSED`, `SUPERVISED` or `ACTIVE` |
| `MUSIC_OS_EXTERNAL_ACTIONS` | `BLOCKED`, `APPROVAL_ONLY` or `ALLOWED` |

Keep `SUPERVISED` / `APPROVAL_ONLY` as the initial posture. The model and credentials must be verified in the deployment environment. `npm start` expects variables already present in the process environment.

## Build and release

```sh
npm install
npm run typecheck
npm run build
npm start
```

Render uses this directory as `rootDir`. CI typechecks and builds the runtime. Deploy a reviewed commit explicitly; the Blueprint disables automatic deployment. [Go-live checks](../docs/GO_LIVE.md) are required in addition to a passing build.
