# Beyond Your Decks — Independent Artist OS

Governed MCP runtime connecting ChatGPT to artist workspaces in the BYD Second Brain.

## What lives here

- [`mcp/`](mcp/README.md): Node/TypeScript MCP server, dashboard and backend adapters.
- [`render.yaml`](render.yaml): Render deployment blueprint.
- [`SECURITY.md`](SECURITY.md): tenant isolation, approvals, secrets and incident policy.
- [`system/PERMISSIONS.md`](system/PERMISSIONS.md): human authority boundaries.
- [`docs/GO_LIVE.md`](docs/GO_LIVE.md): release checks and outstanding production work.

## Current integration status

The former BYD2 Lovable project and Supabase backend are retired and must not be treated as available operational dependencies. The existing `mcp/` code still contains Supabase authentication, database gateway, and queue-worker integrations; these are **legacy implementation dependencies**, not a verified live connection. Do not deploy this runtime as a working Artist OS without replacing or explicitly retiring those code paths and validating the replacement.

The proposed Drive-first team workflow is being reviewed in [pull request #6](https://github.com/santemusic/IndependentArtistOS/pull/6). Its Google Sheets LIVE link and templates currently describe a manual operating process, not an automated MCP-to-Sheets integration.

The legacy MCP implementation was designed to bind connections to user/workspace identity and enforce authorization through the former backend; this is not a claim of current operational availability.

## Development

Requires Node.js 22.

```sh
cd mcp
npm install
npm run typecheck
npm run build
npm start
```

Supply environment variables using [`mcp/.env.example`](mcp/.env.example) as a template. The server reads its process environment; `npm start` does not automatically load a `.env` file.

## Release status

Repository cleanup is not production certification. The current `run_ai_ceo` tool calls OpenAI synchronously; the queue worker described in [issue #2](https://github.com/santemusic/IndependentArtistOS/issues/2) remains separate work. See the go-live checklist before deployment or horizontal scaling.

Historical Buzz packaging, static persona/skill catalogs and planning templates were removed from the current tree because the MCP runtime does not load them. They remain recoverable through Git history.
