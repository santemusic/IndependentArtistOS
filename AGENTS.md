# Repository instructions

## Scope

This repository contains the legacy MCP runtime and Render deployment configuration. The former BYD2 Lovable project and Supabase backend are retired; references to them describe historical integrations, not current production services. Do not invent replacement backend RPC contracts or copy artist business data into this repository.

## Working contract

For material work record the objective, inputs, owner, deliverable, risks, dependencies, approval owner, definition of done and next handoff in the change description. Use an existing goal/project reference when supplied; never fabricate IDs or approvals.

- Keep authenticated user and workspace boundaries intact.
- Preserve human authority in SECURITY.md and system/PERMISSIONS.md.
- Never fabricate missing facts, payments, rights, external execution or completion.
- Never commit secrets or log credentials, raw authorization headers or connection tokens.
- Runtime changes require typecheck and build; use focused tests for changed security or execution behavior.
- Keep consequential external actions gated. Escalate irreversible, legally material, brand-defining or over-budget decisions to the appropriate human.
- Do not deploy, switch production branches or migrate production data as a side effect of documentation cleanup.
- Keep source, deployment configuration and operator documentation consistent.
