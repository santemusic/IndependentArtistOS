# Beyond Your Decks — Independent Artist OS

Governed MCP runtime connecting ChatGPT to artist workspaces in the BYD Second Brain.

## What lives here

- [`mcp/`](mcp/README.md): Node/TypeScript MCP server, dashboard and backend adapters.
- [`render.yaml`](render.yaml): Render deployment blueprint.
- [`SECURITY.md`](SECURITY.md): tenant isolation, approvals, secrets and incident policy.
- [`system/PERMISSIONS.md`](system/PERMISSIONS.md): human authority boundaries.
- [`docs/GO_LIVE.md`](docs/GO_LIVE.md): release checks and outstanding production work.

The product UI, Supabase functions and database schema belong to the [BYD2 Lovable project](https://lovable.dev/projects/7becdc68-b0ff-45d3-ba4b-d86a42e79c29). They are not managed by this repository. Supabase is the canonical store for artist context, memberships, tasks and approvals; model providers supply compute.

Each primary MCP connection is bound to one user and one artist workspace. Multiple artists share the runtime, with authorization enforced by the backend.

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
