# Notion-only connector: go-live checks

**Status: NOT CERTIFIED.** A successful build is not proof of a working Notion integration.

- [ ] CI passes `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Configure only Notion OAuth, MCP signing secret, and public URL.
- [ ] Notion OAuth authorize, refresh and reconnect work end-to-end.
- [ ] An artist in workspace A cannot access or mutate workspace B's pages, tasks or workflow runs.
- [ ] Missing or duplicate Notion resources fail closed.
- [ ] Read scope denies write tools; writes honor supervisor/human approval rules.
- [ ] OAuth one-time code replay fails within a single instance. **Use exactly one running instance** until durable code storage is added.
- [ ] Secrets and Notion API response bodies are not logged or exposed.
- [ ] Deployment rollback, monitoring, incident ownership, and credential revocation are tested.

Do not reuse legacy OAuth connections. Reconnect through Notion, verify the OAuth workspace and owner, and explicitly authorize real artist page IDs in shared-workspace mode. No database migration, artist record deletion, or automatic production deployment occurs as part of this repository change.

## Inspection on 2026-10-19

- Main before this fix: `4f79407c6d65a6542f0bb9c10537537eeeffe6c6`; GitHub MCP CI succeeded.
- Render live deploy: `dep-db2l51aj9qps73cvq7d0`, commit `1b8eb88266278e55a86ccae5c898c53131ab6c77`. Auto-deploy is off. Production remains unchanged.
- Existing production health reported a degraded legacy worker (`DATABASE_HTTP_401_UNKNOWN`).
- Artist Master Context query returned zero records. Do not create an ACL until real artist records and OAuth owners are verified.
- Management Tasks and Automation Control schemas were inspected. The monthly tasks are unassigned templates, not running automation.
- Shared adapter security tests use mocked Notion responses; they are not real OAuth or live permission tests.

Remaining go-live gates: public Notion integration registration and secure secret provisioning; verified owner-to-artist access matrix; real OAuth/refresh/reconnect and two-artist isolation tests; monthly module schema/ownership mapping, durable deduplication/audit and retry behavior; recoverable deploy artifact and configuration rollback. No scheduler or external actions may be enabled before these pass.

The listed live deploy is a rollback reference, not proof its build artifact is still retained. Verify rollback eligibility before replacing production. Preserve configuration securely outside GitHub; deployment rollback does not roll back Notion writes.

## Additional validation (2026-10-19)

- 16 automated tests pass, including an actual local HTTP server with a test-only mocked Notion OAuth upstream. Typecheck and build pass.
- HTTP tests cover registration redirect validation, invalid callback, provider network/JSON failures without process termination, PKCE mismatch, single-use code replay, stale code rejection after restart, refresh client binding, refresh across restart, read-only write rejection, and empty artist ACL rejection.
- Authorization codes now carry a random process boot ID: restarting invalidates pending codes rather than reopening replay. One instance remains required; clients must restart authorization if a deploy interrupts it.
- OAuth and shared Notion requests have a 15-second timeout; request bodies are limited to 1 MiB; unexpected HTTP errors return a generic response without provider payloads.
- These are local integration tests, not a live Notion authorization or a customer permission certificate. No real customer ACLs, accounts or template records were created.
