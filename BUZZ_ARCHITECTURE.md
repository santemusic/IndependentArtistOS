# Artist OS × Buzz Architecture

## Objective
Implement the Artist OS as a multi-agent operating company on Buzz. The Artist is Chairperson, the Executive layer converts goals into coordinated work, each business function is an Agency, and specialist agents operate as employees of an Agency CEO.

```text
ARTIST / HUMAN CHAIRPERSON
        |
        v
ARTIST CEO
        |
        +--> CHIEF OF STAFF
        +--> MUSIC CEO ---------- specialists
        +--> RELEASE CEO -------- specialists
        +--> CONTENT CEO -------- specialists
        +--> GROWTH CEO --------- specialists
        +--> PR CEO ------------- specialists
        +--> LIVE CEO ----------- specialists
        +--> PARTNERSHIPS CEO --- specialists
        +--> RELATIONSHIP CEO --- specialists
        +--> COMMERCE CEO ------- specialists
        +--> FINANCE CEO -------- specialists
        +--> LEGAL CEO ---------- specialists
        +--> DATA CEO ----------- specialists
        +--> OPS CEO ------------ specialists
        +--> AUTOMATION CEO ----- specialists
```

## Boundaries
**Git repository:** source-controlled constitution, personas, skills, workflows, schemas, templates and project records.

**Buzz:** live workspace, agent identity, channels, conversations, workflow traces, repository collaboration and audit/event history.

**MCP / external systems:** execution adapters for distribution, analytics, calendars, CRM, files, communications, accounting, ticketing, storefronts and other systems. Credentials remain outside Git.

## Mapping
| Artist OS | Buzz |
|---|---|
| Agency | Channel + CEO + specialist personas |
| Employee | Independent agent identity/persona |
| Skill/SOP | Persona skill / operating document |
| Cross-agency request | Structured message/@mention handoff |
| Workflow | `.buzz/workflows/*.yaml` |
| Policy | root instructions + `system/*` |
| Project record | Git/Buzz collaborative document |
| Human gate | explicit approval protocol |

## Rollout
1. Create agency channels and core CEO identities.
2. Activate Artist CEO, Chief of Staff, Ops, Release, Content, Growth and Data.
3. Run one real single release end-to-end.
4. Capture friction and refine SOPs.
5. Add specialist agents only where workload requires them.
6. Add MCP integrations using least privilege.
7. Automate stable processes only after manual operation is reliable.

## First production workflow
**Artist Goal → Release Plan → Music Readiness → Content Factory → Growth Launch → Release-Day Command → D7 Analysis → Postmortem.**

## Compatibility rule
Treat workflow examples as implementation templates and validate exact action/trigger syntax against the Buzz version deployed. Business-critical approvals for contracts, money, rights and sensitive publishing remain explicit human gates until native approval behavior has been verified end-to-end.
