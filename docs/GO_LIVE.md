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

Authorization-code consumption now uses shared atomic database storage, and refresh tokens bind to their issuing client. RLS being enabled alone is not evidence that its policies are correct.

## Release procedure

Record candidate commit, backend migration revision, test evidence, known blockers, incident owner and the human go/no-go decision. Deploy the reviewed candidate explicitly, verify authenticated workspace reads and the governed test request, and retain the prior deployment for rollback. Do not enable external integrations without least-privilege scopes, explicit approval rules, idempotency and remote-state verification.

## Cleanup boundary

Removed static Buzz packaging, catalogs, templates and their validator are recoverable from Git history. Runtime source, imported compatibility adapters, dashboard, security policy and human approval boundaries remain. No database, live artist record or deployment is deleted by this cleanup.

## Execution hardening, 2026-10-06

Applied `docs/security/20261006_execution_hardening.sql` to the canonical BYD2 backend (`ptxwdxnbfmlafumwaxcu`). The similarly named dashboard project `blauyjcrhbwedfilwcdp` is not this app backend.

The migration and its regression fixture passed together in a rolled-back transaction, then the fixture passed again against the committed definitions. Evidence covers task/approval deduplication, kill-switch enforcement, single claim, refusal of unclaimed completion, pause during execution, repeat completion, late failure after success, cross-workspace run/request rejection, OAuth code replay rejection, and malformed responses. No fixture records persisted.

Runtime security tests cover scope enforcement, invalid AI output, provider-error redaction, and ambiguous completion without duplicate provider calls. Deployment must verify `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `OPENAI_API_KEY` and an accessible `BYD_OPENAI_MODEL`. Keep secrets out of this repository. The release remains uncertified until a live authenticated OAuth/worker request, deployment recovery and operational ownership are verified.

## Render verification, 2026-10-06 09:34 UTC

Release `84302603b8a5d4e89cbd1ef28fc46b12d7b46d57` is deployed on Render (`dep-db2c0sm7bikc73d8dc80`). The service now tracks `main`, builds with `cd mcp && npm ci && npm run build`, and checks `/health`. All seven local security tests, typecheck and build passed. Runtime mode remains `SUPERVISED`.

**Release acceptance is blocked:** the live worker reports `recovery:DATABASE_HTTP_401_UNKNOWN`. The server credential is configured, but the canonical Supabase endpoint rejects it. The recovery RPC itself succeeds when tested under the database service role. This is not a verified working database credential. OAuth one-time-code exchange and the real provider/queue test remain unverified and blocked. No production test artist/request was created. No rollback was executed; the new security controls remain deployed.

Next handoff: replace `SUPABASE_SERVICE_ROLE_KEY` directly in Render with a valid server key for `ptxwdxnbfmlafumwaxcu`; never paste it into chat or commit it. Redeploy, require `/health` worker state `polling` without `lastError`, then complete authenticated OAuth and a synthetic AI request. The service still uses a Free instance that can spin down; continuous background processing and scaling require an explicitly selected always-on compute plan.
