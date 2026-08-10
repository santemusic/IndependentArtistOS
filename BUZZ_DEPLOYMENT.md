# Independent Artist OS — Buzz Deployment Layer

## Status

Step 17 converts the repository from an architecture-only collection into a Buzz Persona Pack source plus a first schema-aligned workflow.

The current Buzz Persona Pack specification requires an OPS-compatible `.plugin/plugin.json` manifest whose `personas` list is authoritative. Persona files live flat under `agents/`, skills under `skills/<name>/SKILL.md`, and optional pack-wide instructions can be referenced by `pack_instructions`.

Important current-runtime limitation: Buzz's own `examples/meadow-core/README.md` states that direct persona-pack runtime integration with the desktop app is not currently implemented. The CLI can validate and inspect a pack, while desktop agent/team Import currently expects exported `.agent.json` / `.team.json` snapshots rather than a persona-pack directory or zip. Therefore this repository should distinguish PACK VALID from DESKTOP IMPORTABLE.

## What Step 17 added

1. `.plugin/plugin.json` — authoritative Persona Pack manifest.
2. A curated activation roster rather than registering every specialist immediately.
3. A corrected `.buzz/workflows/release-readiness.example.yaml` using the current Buzz workflow schema.
4. This deployment guide and compatibility rules.

## Initial activation roster

The manifest intentionally activates the executive layer, all Agency CEOs and the technical orchestrator first. Specialist persona files remain in the repository and can be added to the manifest after the first release loop is proven.

This reduces channel noise, runtime cost and coordination failure while preserving the complete workforce design.

### Executive
- artist-ceo
- executive-chief-of-staff
- goal-architect
- decision-intelligence
- executive-dashboard
- portfolio-controller
- executive-briefing

### Agency CEOs
- ops-ceo
- music-ceo
- release-ceo
- content-ceo
- growth-ceo
- data-ceo
- pr-ceo
- live-ceo
- partnerships-ceo
- relationship-ceo
- legal-ceo
- finance-ceo
- commerce-ceo
- automation-ceo

### Infrastructure
- orchestrator

## Why specialists are not all registered yet

A Persona Pack can contain many personas, but a production Artist OS should not equate 'file exists' with 'agent should be running'. Activation is a deployment decision.

Specialists should be promoted in waves:

- Wave 1: Executive + Agency CEOs + Orchestrator.
- Wave 2: Release-critical specialists for one real release.
- Wave 3: Content/Growth/Data specialists.
- Wave 4: Live/Partnerships/CRM/Commerce specialists.
- Wave 5: deeper Legal/Finance/Automation specialists as integrations and permissions mature.

## Buzz Persona Pack compatibility

The repository follows the documented layout:

```text
IndependentArtistOS/
├── .plugin/
│   └── plugin.json
├── agents/
│   └── *.persona.md
├── skills/
│   └── <skill>/SKILL.md
├── instructions.md
├── .buzz/
│   └── workflows/
└── ...operating records/templates
```

Each registered persona must have `name`, `display_name` and `description` in YAML frontmatter. Skills referenced by personas must have valid `name` and `description` frontmatter in their `SKILL.md`.

## Skill runtime note

Buzz's Persona Pack spec currently describes pack skill copying/discovery behavior while also marking parts of skill-path resolution/runtime copying as planned. Do not assume a declared skill has actually been loaded in a running agent merely because pack validation succeeds. Verify the deployed Buzz/buzz-acp version and inspect the resolved agent environment.

## Workflow compatibility

Current Buzz workflow definitions use:

```yaml
name: Example
trigger:
  on: message_posted
steps:
  - id: step_id
    action: send_message
    text: Hello
```

Supported trigger types in the current schema include `message_posted`, `reaction_added`, `diff_posted`, `schedule` and `webhook`.

Supported actions include `send_message`, `send_dm`, `set_channel_topic`, `add_reaction`, `call_webhook`, `request_approval` and `delay`.

Step IDs must contain only ASCII alphanumeric characters or underscores.

## Release-readiness workflow

`.buzz/workflows/release-readiness.example.yaml` now uses the actual schema names `message_posted`, `send_message.text`, `add_reaction` and `request_approval.from/message/timeout`.

Trigger command:

```text
RUN_RELEASE_READINESS
```

The workflow:

1. acknowledges the command;
2. asks Release and Operations CEOs for the cross-Agency readiness report;
3. pauses at an Artist CEO approval checkpoint;
4. after approval, instructs Release to continue only within delegated authority.

The workflow deliberately does not call external webhooks or attempt money movement, contract execution, rights changes or publication.

## Important Buzz workflow limitation

The Buzz source currently documents workflow action dispatch as still having placeholder/ongoing executor wiring in parts of the implementation. Buzz project documentation also describes approval infrastructure as existing while executor wiring is in progress. Treat a workflow definition as CONFIGURED, not VERIFIED EXECUTABLE, until it has been tested against the exact deployed Buzz build.

## Validation commands

From a checkout with the Buzz CLI available:

```bash
buzz pack validate .
buzz pack inspect .
```

A successful pack validation means the source structure/config is acceptable to that CLI version. It does not prove desktop import, external integrations or every runtime action works end-to-end.

## Desktop deployment reality

Do not attempt to import this repository or a zip of it through the current desktop Import control expecting Persona Pack installation. Buzz's example documentation says that Import accepts exported agent/team snapshots (`.agent.json` / `.team.json`) and that direct persona-pack runtime integration is not currently implemented.

Until that changes, use the pack as:

1. a validated source-of-truth for personas/skills;
2. an inspectable resolved configuration;
3. a reference for recreating/starting agents in the supported Buzz deployment path;
4. a repository for Buzz workflows and future native pack deployment.

## Production rollout gate

Before calling Independent Artist OS 'live', verify all of the following against the exact Buzz version:

- [ ] `buzz pack validate .` passes.
- [ ] `buzz pack inspect .` resolves all registered personas.
- [ ] Every registered skill is present and discoverable at runtime.
- [ ] Required channels exist and subscriptions match their identifiers.
- [ ] Agent mentions resolve to the deployed identities.
- [ ] The release-readiness workflow can be created/loaded in the target community/channel.
- [ ] `RUN_RELEASE_READINESS` triggers exactly one workflow run.
- [ ] Approval pause/resume works end-to-end.
- [ ] Duplicate command/event behavior is understood.
- [ ] Failed actions are visible rather than silently lost.
- [ ] No secrets exist in the repository/persona prompts.
- [ ] No agent has unnecessary write/admin authority.
- [ ] Human approval boundaries remain intact.

## Definition of done for Step 17

Step 17 is complete at repository level when the pack manifest exists, the first workflow conforms to the inspected Buzz schema, and the runtime limitations are documented truthfully.

Actual live deployment remains a separate environment step because it requires a running Buzz installation/community, configured agent runtime/model credentials and runtime validation that GitHub repository edits alone cannot perform.
