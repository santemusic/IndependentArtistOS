# Independent Artist OS × Buzz

A governed multi-agent operating system for independent artists, designed for Buzz-style human + agent collaboration.

## Status

**Architecture: `v1.0.0-rc.1` — complete.**  
**Production certification: pending official Buzz validation + runtime sandbox acceptance.**

This distinction is intentional: repository architecture is finished, but the project must not claim a production runtime PASS until the actual Buzz environment has been validated and `TEST_RELEASE_001` has been executed successfully.

## Operating model

**Artist (human Chairperson) → Artist CEO → Executive Chief of Staff → Agency CEOs → specialist employees → governed workflows → human approvals → measurable outcomes.**

The OS treats every major artist-business function as an Agency: Executive, Music, Release, Content Factory, Marketing & Growth, PR & Media, Live, Partnerships, Relationship CRM, Commerce, Finance, Legal & Rights, Data & Intelligence, Operations/PMO, and Technology/Automation.

## Wave-1 runtime

The Buzz manifest intentionally activates a smaller control plane first:

- Artist CEO
- Executive Chief of Staff
- Operations CEO
- Music CEO
- Release CEO
- Content CEO
- Growth CEO
- Data CEO
- Legal CEO
- Finance CEO
- Automation CEO
- Orchestrator

The larger specialist workforce remains source-controlled and is activated only after tested workload, routing, permissions and evaluation cases exist.

## Start here

- `ARTIST_OS.md` — master operating specification
- `AGENTS.md` — Agency and agent roster
- `BUZZ_ARCHITECTURE.md` — Buzz mapping
- `BUZZ_VALIDATION.md` — structural + official validation procedure
- `WAVE1_RUNTIME.md` — Wave-1 deployment and smoke test
- `sandbox/TEST_RELEASE_001.md` — canonical end-to-end sandbox fixture
- `STEP20_SANDBOX_RUNBOOK.md` — runtime test procedure
- `system/INTEGRATION_REGISTRY.yaml` — integration ownership/risk registry
- `STEP21_INTEGRATIONS.md` — controlled integration rollout
- `PRODUCTION_READINESS.md` — final v1.0 production gate
- `SECURITY.md` — security and trust-boundary policy
- `system/PERMISSIONS.md` — human/agent authority boundaries
- `.buzz/workflows/` — Buzz workflow examples

## Core governance

AI agents may research, draft, classify, organize, monitor, prepare, recommend and coordinate within their authority. Human approval remains mandatory for reserved high-impact actions such as legal execution, ownership/rights changes, major unbudgeted spend, designated final masters/artwork, sensitive public communication, money movement and destructive/privileged actions.

`UNKNOWN` is a valid state. Agents must not invent rights clearance, cash, release delivery, approval, publication, spend, audience performance or external execution.

## Validation

Repository structural check:

```bash
python -m pip install pyyaml
python tools/validate_buzz_pack.py
```

Official runtime-level check with the target Buzz CLI:

```bash
buzz pack validate .
buzz pack inspect .
```

The official installed Buzz validator is authoritative when its behavior differs from repository assumptions.

## Installation target

After validation, the Persona Pack is designed for Git-based Buzz installation. For controlled production, pin installation to a reviewed tag/revision rather than relying indefinitely on a moving branch.

## Finish line

There is no required Step 23 for architecture construction. Promotion to `v1.0.0` is evidence-based and requires the gates in `PRODUCTION_READINESS.md`: official Buzz validation, Wave-1 sandbox acceptance, security/permission verification, reliability tests and one controlled live-project acceptance cycle.

After that, changes are normal product iteration rather than continued OS construction.
