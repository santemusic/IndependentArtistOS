# Buzz Persona Pack Validation

This repository is designed as a Buzz Persona Pack. Validation has two layers: repository structural validation and the official Buzz runtime validator.

## 1. Structural CI validation

Run:

```bash
python -m pip install pyyaml
python tools/validate_buzz_pack.py
```

The validator checks:

- `.plugin/plugin.json` exists and parses.
- Required pack fields exist.
- Every persona registered in the manifest exists.
- Registered personas are flat `agents/*.persona.md` files.
- Persona YAML frontmatter parses and contains `name`, `display_name`, and `description`.
- Agent names are unique and use safe lowercase/hyphen identifiers.
- Every persona skill reference resolves inside the pack.
- Every skill directory contains `SKILL.md`.
- Skill frontmatter contains `name` and `description` and the name matches its directory.
- `.buzz/workflows/*.yaml` files parse and use known Buzz trigger/action names covered by this repository validator.
- `send_message` uses `text` and approval steps contain their required fields.

GitHub Actions runs the same check on pushes to `main`, pull requests, and manual dispatch.

## 2. Official Buzz validation

The repository validator is intentionally not a substitute for Buzz itself. With the current Buzz CLI installed, run from the repository root:

```bash
buzz pack validate .
buzz pack inspect .
```

`buzz pack validate` is the final authority for Persona Pack/runtime conformance. `buzz pack inspect` is useful for reviewing the resolved pack before activation.

## 3. Validation policy

A pack change is not considered runtime-ready until:

1. Repository structural validation passes.
2. Official `buzz pack validate .` passes against the Buzz version being deployed.
3. `buzz pack inspect .` shows the expected registered personas and resolved configuration.
4. Wave-1 agents are tested in a non-production/sandbox context.
5. The release-readiness workflow is exercised without granting irreversible authority.

## 4. Current deployment strategy

Do not activate every specialist on day one. The manifest intentionally registers the executive layer, Agency CEOs, and orchestrator as the initial control plane. Specialist agents remain in the repository and can be added to the manifest in controlled waves after their workflows, permissions and evaluation cases are ready.

## 5. Buzz version drift

Buzz is evolving. Re-run the official validator whenever:

- Buzz is upgraded.
- `.plugin/plugin.json` changes.
- Persona frontmatter changes.
- Skill references change.
- Workflow schema changes.
- New runtime integrations or permissions are introduced.

If repository assumptions conflict with the installed Buzz validator, the installed Buzz version wins and the pack must be updated deliberately.

## 6. Step 18 completion gate

Step 18 is complete when the repository has automated structural validation and a documented official-runtime validation path. Step 19 is responsible for activating and testing the Wave-1 runtime team in the target Buzz environment.
