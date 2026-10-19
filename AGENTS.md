# Repository instructions

This repository owns only the multi-artist Notion MCP connector and deployment configuration.

- Only the Notion API is an external data integration; no additional backend, worker, or product UI.
- All artist reads and writes must use the authenticated connection's Notion token; never fall back to a global/shared token.
- In shared-workspace mode, bind permissions to the verified Notion OAuth workspace AND owner. Accept an artist ID only after checking the server-side allowlist and database ownership. Never infer authorization from names or client input.
- Always verify record/database ownership before editing an existing Notion page.
- Never commit secrets or log Notion credentials, OAuth codes, authorization headers, or raw tokens.
- Use least privilege and respect human approvals; no external payments, rights transfers, publishing, or messaging.
- Changes must pass tests, typecheck and build.
- Do not deploy or migrate data automatically as a side effect of code changes.
