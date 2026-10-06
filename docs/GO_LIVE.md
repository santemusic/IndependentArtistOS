# Go-live acceptance

Status: **NOT CERTIFIED**. Cleanup removes obsolete packaging; it does not establish production readiness.

## System ownership

- This repository: MCP server and Render configuration.
- BYD2 Lovable project: app, Supabase functions and database contracts.
- Supabase: canonical artist/workspace data and authorization.
- Provider: compute only.

Do not initialize a second database or infer readiness from a project's healthy status. Verify the deployed app, MCP service and database reference the same intended backend without exposing secrets.

## Required evidence

- [ ] Candidate commit passes typecheck and build in CI.
- [ ] OAuth sign-in, workspace selection, revocation and expiry work end to end.
- [ ] Read-only scopes cannot invoke writes.
- [ ] Two independent test workspaces cannot read, link or modify each other's records.
- [ ] Queue worker claims atomically, validates the stored response schema and completes/fails through governed RPCs.
- [ ] One real test request reaches `QUEUED -> CLAIMED -> SUCCEEDED` with at most three tasks.
- [ ] Concurrent/repeated identical requests do not duplicate tasks or approvals.
- [ ] Pause and kill switch prevent writes, including when changed during model execution.
- [ ] Consequential actions stage approval and never execute externally.
- [ ] Failed, timed-out and interrupted jobs have bounded recovery with no false success.
- [ ] Secrets stay out of logs, responses and prompts; provider costs and per-workspace usage are bounded.
- [ ] Backup restoration, deployment rollback, monitoring and incident ownership are verified.

Before multiple server replicas, replace in-memory authorization-code replay tracking with shared atomic storage and verify refresh-token/client binding. RLS being enabled alone is not evidence that its policies are correct.

## Release procedure

Record candidate commit, backend migration revision, test evidence, known blockers, incident owner and the human go/no-go decision. Deploy the reviewed candidate explicitly, verify authenticated workspace reads and the governed test request, and retain the prior deployment for rollback. Do not enable external integrations without least-privilege scopes, explicit approval rules, idempotency and remote-state verification.

## Cleanup boundary

Removed static Buzz packaging, catalogs, templates and their validator are recoverable from Git history. Runtime source, imported compatibility adapters, dashboard, security policy and human approval boundaries remain. No database, live artist record or deployment is deleted by this cleanup.
