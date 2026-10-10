# Beyond Your Decks — Independent Artist OS

## Start here: Drive-first Team-Betrieb

Prozessversion: `2026-10-10-drive-first-v1` (2026-10-10 Drive-first v1.0). Der neue Arbeitsablauf ist ein manuell geführter gemeinsamer Team-Prozess.

- **Drive LIVE ist die operative Quelle:** Artists, Release-Cycles, Aufgaben, Zuständigkeiten, Quellenstände und Freigaben werden gemeinsam dort gepflegt.
- **GitHub ist die Prozessquelle:** Regeln, Vorlagen, Schemas, synthetische Beispiele und Änderungen am Prozess werden hier versioniert. Keine echten Artist-Daten oder Unterlagen in dieses öffentliche Repository übernehmen.
- **Ein operativer Stand:** keine parallelen JSON-, Notion- oder Supabase-Bestände für den neuen Ablauf. Notion und Supabase sind dafür keine Voraussetzung.

1. [Gemeinsamen Drive-Arbeitsbereich öffnen](https://drive.google.com/drive/folders/1ELleaZx9UdRV6-y6vw4d3a-azcHmmTZ_). Zugang nur für berechtigte Mitarbeiter; dieser Link erteilt keinen Zugriff.
2. [LIVE-Arbeitsstand öffnen](https://docs.google.com/spreadsheets/d/14Jg_XCytKwLEqMIQZy6kZ3J-EwiU6kFVyQ8Naqgxqac/edit) und vorhandenen Artist/Cycle vor einer Neuanlage suchen.
3. [MASTER-Prozessvorlagen lesen](https://docs.google.com/spreadsheets/d/1o-1_71T8ghBDmlMhQaWTgsF2Kc6AmTWYrzeeHWCi1yk/edit); dann dem [Team-Schnellstart](workflow/DRIVE_FIRST.de.md) folgen.
4. Owner, nächste interne Aufgabe und fehlende Belege im LIVE-Stand pflegen. Entscheidungen und Außenaktionen benötigen überprüfbare menschliche Freigaben.

[Prozessregeln](workflow/PROCESS.de.md) · [24 Task-Vorlagen](workflow/templates/release-tasks.json) · [18 Input-Arten](workflow/templates/input-catalog.json) · [Team-Zusammenarbeit](TEAM_ARCHITECTURE.de.md) · [Prüfgrenzen](INTEGRATION.de.md).

**Keine automatische Ausführung:** Links und Vorlagen erzeugen keine Aufgaben, Erinnerungen, Freigaben oder Veröffentlichungen. [Die optionale lokale CLI](workflow/README.de.md) prüft synthetische Prozessdaten; sie ist kein operativer Datenspeicher und synchronisiert nicht mit Drive. Die bisherigen 18 CLI-Tests sind kein Nachweis einer produktiven Team-Abnahme.

## Bisheriger technischer Runtime-Pfad (Legacy, nicht Standard des neuen Ablaufs)

Der folgende Bestand bleibt für Nachvollziehbarkeit und mögliche spätere Integrationsarbeit erhalten. Er wird durch diesen Draft weder aktiviert, entfernt noch als Produktionsstand zertifiziert. [Versionskatalog und Rückkehrgrundlage](docs/VERSION_CATALOG.de.md).

Governed MCP runtime connecting ChatGPT to artist workspaces in the BYD Second Brain.

### What lives here

- [`mcp/`](mcp/README.md): Node/TypeScript MCP server, dashboard and backend adapters.
- [`render.yaml`](render.yaml): Render deployment blueprint.
- [`SECURITY.md`](SECURITY.md): tenant isolation, approvals, secrets and incident policy.
- [`system/PERMISSIONS.md`](system/PERMISSIONS.md): human authority boundaries.
- [`docs/GO_LIVE.md`](docs/GO_LIVE.md): release checks and outstanding production work.

The product UI, Supabase functions and database schema belong to the [BYD2 Lovable project](https://lovable.dev/projects/7becdc68-b0ff-45d3-ba4b-d86a42e79c29). They are not managed by this repository. Supabase is the canonical store for artist context, memberships, tasks and approvals; model providers supply compute.

Each primary MCP connection is bound to one user and one artist workspace. Multiple artists share the runtime, with authorization enforced by the backend.

### Development

Requires Node.js 22.

```sh
cd mcp
npm install
npm run typecheck
npm run build
npm start
```

Supply environment variables using [`mcp/.env.example`](mcp/.env.example) as a template. The server reads its process environment; `npm start` does not automatically load a `.env` file.

### Release status

Repository cleanup is not production certification. The current `run_ai_ceo` tool calls OpenAI synchronously; the queue worker described in [issue #2](https://github.com/santemusic/IndependentArtistOS/issues/2) remains separate work. See the go-live checklist before deployment or horizontal scaling.

Historical Buzz packaging, static persona/skill catalogs and planning templates were removed from the current tree because the MCP runtime does not load them. They remain recoverable through Git history.
