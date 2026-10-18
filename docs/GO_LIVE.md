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

Do not reuse old Lovable/Supabase/OAuth connections. Reconnect each artist's separate Notion workspace through the new connector. No database migration, artist record deletion, or automatic production deployment occurs as part of this repository change.
