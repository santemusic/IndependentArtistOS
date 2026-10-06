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

The server provides artist context, operating snapshots, tasks, CRM, activity, discovery, Second Brain and runtime information; controlled writes create/update internal records and stage approvals. `run_ai_ceo` queues a request through the canonical backend. `get_ai_request` returns its scoped status and result. The in-process worker atomically claims requests, validates the stored JSON schema and the CEO contract, and completes through governed database RPCs. A runtime row lock serializes pause/kill-switch changes with writeback.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only queue and OAuth replay RPC access; never a public/anon key |
| `OPENAI_API_KEY` | Server-side key for the queue worker |
| `BYD_OPENAI_MODEL` | Model configured by the operator |
| `MUSIC_OS_RUNTIME_MODE` | `PAUSED`, `SUPERVISED` or `ACTIVE` |
| `MUSIC_OS_EXTERNAL_ACTIONS` | `BLOCKED`, `APPROVAL_ONLY` or `ALLOWED` |

Keep `SUPERVISED` / `APPROVAL_ONLY` as the initial posture. The model and credentials must be verified in the deployment environment. `npm start` expects variables already present in the process environment.

## Build and release

```sh
npm ci
npm test
npm run typecheck
npm run build
npm start
```

Render uses this directory as `rootDir`. CI runs security regression tests, typechecks and builds the runtime. Deploy a reviewed commit explicitly; the Blueprint disables automatic deployment. [Go-live checks](../docs/GO_LIVE.md) are required in addition to a passing build.

## Worker limits and prerequisites

`/health` reports process liveness and separate worker readiness flags. Missing database/provider configuration disables the worker and the CEO tool refuses new queued work. OAuth code exchange requires the server database credential and the applied `consume_mcp_oauth_code` RPC. Existing refresh tokens issued before client binding must reconnect.

The worker processes one provider call at a time per process, has a 60-second provider timeout and no automatic paid model retry. Completion is retried once without repeating the provider call. The configured model is the sole allowed model, prompts are limited to 64,000 characters, and output is limited to 3,000 tokens and three actions. Each workspace can create at most ten new requests per hour; identical requests reuse the existing ID. Failed/blocked requests remain terminal and must not be silently replayed. These limits bound usage; they are not a monetary budget or provider billing alert.

Stale recovery runs every minute and marks interrupted requests/runs failed. All consequential actions require pending approval regardless of AUTO policy. No automatic external executor, scheduler or provider fallback is included. Multiple instances share atomic claims and OAuth code consumption, but coordinated global concurrency and cost limits still require separate capacity planning.

Apply the recorded SQL migration explicitly to the BYD2 backend. The SQL regression fixture must run inside `BEGIN` / `ROLLBACK`. The MCP process never applies migrations on startup.
