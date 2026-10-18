# Repository instructions

This repository owns only the multi-artist Notion MCP connector and deployment configuration.

- No Lovable, Supabase, third-party backend, in-process AI worker, or product UI integration.
- All artist reads and writes must use the authenticated connection's Notion token; never fall back to a global/shared token.
- Treat each Notion OAuth workspace as a separate artist boundary. Do not accept a client-supplied artist ID to cross that boundary.
- Always verify record/database ownership before editing an existing Notion page.
- Never commit secrets or log Notion credentials, OAuth codes, authorization headers, or raw tokens.
- Use least privilege and respect human approvals; no external payments, rights transfers, publishing, or messaging.
- Changes must pass tests, typecheck and build.
- Do not deploy or migrate data automatically as a side effect of code changes.
