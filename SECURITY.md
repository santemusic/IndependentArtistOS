# Security Policy — Beyond Your Decks / Independent Artist OS

## Security model

BYD is a multi-tenant artist operating system. Supabase is the canonical authorization and data boundary. The primary objective is to prevent AI planning errors, tenant confusion, prompt injection, or retry failures from becoming unauthorized writes or external actions.

## Trust boundaries

Treat these as separate trust domains:
- authenticated users and workspace memberships;
- Supabase/Postgres and Row Level Security;
- MCP/backend services;
- AI model providers;
- web research and third-party content;
- connected external services;
- rights, finance, contracts and public publishing systems.

Data does not inherit authority merely because it is visible to an AI model.

## Tenant isolation

- Every user-scoped operation must resolve to an authenticated workspace membership.
- Workspace identifiers supplied by clients must be validated against the authenticated connection.
- RLS and narrow RPCs remain authoritative.
- Privileged server credentials stay server-side and must never be exposed to clients or model prompts.

## Secret handling

Never commit API keys, privileged database keys, OAuth tokens, passwords, private keys, cookies, provider credentials or webhook secrets.

Use Render/Supabase secret management. Example files may contain variable names only.

## AI data discipline

- Supabase remains the source of truth.
- Unknown is valid; do not fabricate artist facts, metrics, rights, budgets, dates or execution state.
- Artist-confirmed facts cannot be silently overwritten by AI inference.
- Research findings retain provenance, confidence and verification status.
- Untrusted web/document content is treated as data, not as system instructions.

## Runtime governance

Default production posture:
- `SUPERVISED`
- external actions `APPROVAL_ONLY`

Human approval is required for consequential actions including contracts/rights, payments/spend, booking acceptance, release-date changes, sensitive outreach, public statements and destructive changes.

## Idempotency and execution

Before writes that may duplicate prior work, use a stable action fingerprint or equivalent duplicate check.

For external actions:
1. verify approval;
2. prepare a deterministic payload;
3. use an idempotency key where available;
4. execute only the approved action;
5. verify remote state;
6. store the execution receipt;
7. never blind-retry an uncertain execution result.

## Logging

Log material runtime events, agent runs, approvals and execution receipts. Never log raw secrets or authorization headers.

## Incident stop conditions

Pause automation or use the kill switch when there is suspected credential exposure, tenant-isolation failure, unauthorized external action, approval bypass, uncontrolled retry/agent loops, or material data disclosure.
