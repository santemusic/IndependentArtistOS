# Founder Setup — Artist OS inside ChatGPT

This is the non-technical setup path for the first working Artist OS.

## What you are building

You do not need to install a separate artist app.

The product lives in ChatGPT:

ChatGPT -> Artist OS plugin -> Music OS MCP server -> artist's Notion Music OS

The first version uses one deployed MCP service per artist. This keeps setup simple while we build the multi-tenant login layer.

## Part 1 — Prepare the artist's Notion OS

For each artist you need five values:

1. a Notion integration token;
2. Artist Master Context page ID;
3. Projects database ID;
4. Tasks database ID;
5. Automation Runs database ID.

The Notion integration must have access only to the artist workspace/pages needed by Music OS.

Never paste the Notion token into GitHub.

## Part 2 — Deploy the MCP server

Recommended beginner route: Render.

1. Merge the MCP pull request into main.
2. Sign in to Render with GitHub.
3. Choose New -> Blueprint.
4. Select santemusic/IndependentArtistOS.
5. Render finds the root render.yaml.
6. Create the Blueprint.
7. When Render asks for secret environment values, enter the five values from Part 1.
8. Keep MUSIC_OS_RUNTIME_MODE=SUPERVISED.
9. Keep MUSIC_OS_EXTERNAL_ACTIONS=APPROVAL_ONLY.
10. Deploy.
11. Open the generated Render URL. The root page should say: Independent Artist OS MCP server.
12. Your ChatGPT MCP URL is the same URL plus /mcp.

Example: https://your-service.onrender.com/mcp

## Part 3 — Add it to your own ChatGPT

1. Open ChatGPT.
2. Go to Settings -> Security and login.
3. Turn on Developer mode.
4. Go to ChatGPT Plugins.
5. Press the + button.
6. Paste your HTTPS /mcp URL.
7. Name it Artist OS.
8. Use description: Digital Management Office for independent artists.
9. Create the plugin.
10. Open a new ChatGPT conversation.
11. Select the plugin from the plugin/More menu.
12. Ask: Open my Artist OS.

The native management dashboard should appear from the get_operating_snapshot tool.

## Part 4 — Smoke test

Test A: Open my Artist OS.
Expected: artist name, 90-day goal, weekly Top 3, current bottleneck, open task count.

Test B: What should I focus on this week?
Expected: the model reads the operating snapshot and does not invent missing artist facts.

Test C: Create a task to review my release artwork tomorrow.
Expected: a task is created in the Music OS Tasks database.

Test D: Increase my ad budget and execute it now.
Expected in this version: the system may stage/request approval, but must not actually execute ad spend.

## Part 5 — Add another artist today

Until multi-tenant authentication is built, repeat the Render Blueprint deployment for each artist.

Each artist gets one isolated Render service, their own Notion token, their own page/database IDs, and their own ChatGPT plugin connection.

Do not reuse one artist's Notion credentials for another artist.

## What changes later

The scalable version replaces one deployment per artist with:

ChatGPT -> one public Artist OS plugin -> login -> Artist Connection Registry -> correct artist workspace

At that point an artist installs the public plugin once and signs in instead of configuring an MCP URL.

## Founder rule

Do not enable autonomous external execution yet. Keep the runtime in SUPERVISED and external actions in APPROVAL_ONLY until tenant isolation, OAuth, persisted idempotency and sandbox tests are complete.
