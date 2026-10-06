# Beyond Your Decks — Independent Artist OS

BYD is a multi-tenant Artist Second Brain and AI management operating system for independent artists.

## Current architecture

- **Supabase/Postgres** — canonical source of truth, tenant isolation, runtime state, tasks, approvals, research, CRM, knowledge and audit logs.
- **Lovable** — product UI for artist onboarding and operating workflows.
- **MCP on Render** — governed ChatGPT / AI access to the Artist OS.
- **AI providers** — compute only. They do not own artist state.
- **Runtime governance** — SUPERVISED by default; consequential external actions require approval.

## Primary product loop

```
Artist onboarding
→ AI Artist Positioning research
→ artist review / confirmation
→ Second Brain
→ operating readiness
→ AI CEO
→ weekly priorities / specialist work
→ approvals
→ results / learnings
→ next CEO cycle
```

## Repository layout

- `mcp/` — production MCP server and Supabase adapter.
- `agents/` — reusable specialist persona definitions.
- `skills/` — reusable operating skills.
- `system/` — governance schemas and permission rules.
- `templates/` — reusable operating templates.
- `SECURITY.md` — current security model.
- `render.yaml` — Render deployment blueprint.

## Source-of-truth rules

1. Supabase is authoritative for artist-specific data.
2. AI must not invent missing artist facts.
3. Artist-confirmed facts must not be silently overwritten by AI inference.
4. Internal writes respect runtime mode and idempotency.
5. Consequential external actions require explicit approval.
6. External actions are not assumed successful without execution evidence.

## Development

```bash
cd mcp
npm install
npm run typecheck
npm run build
npm start
```

## Deployment

The active MCP service runs on Render. Configuration is supplied through environment variables; no production credentials belong in Git.

See `mcp/README.md`, `mcp/.env.example`, `render.yaml`, and `SECURITY.md`.

## Legacy files

Some historical Buzz / Notion pilot files remain as minimal deprecated stubs because repository file deletion is restricted in the current automation environment. They are not part of the production architecture.
