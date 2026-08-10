#!/usr/bin/env python3
"""Structural validator for the Independent Artist OS Buzz Persona Pack.

This checks repository invariants that are defined by the current Buzz Persona Pack
specification: manifest presence/shape, registered persona existence, persona frontmatter,
skill references, skill metadata, duplicate agent names, and workflow YAML shape.

It does not replace `buzz pack validate`; run the official Buzz CLI validator as the final
runtime-level check whenever the Buzz CLI is available.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required: python -m pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / ".plugin" / "plugin.json"

REQUIRED_PERSONA_FIELDS = {"name", "display_name", "description"}
REQUIRED_SKILL_FIELDS = {"name", "description"}
VALID_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
VALID_WORKFLOW_TRIGGERS = {
    "message_posted",
    "reaction_added",
    "diff_posted",
    "schedule",
    "webhook",
}
VALID_WORKFLOW_ACTIONS = {
    "send_message",
    "send_dm",
    "set_channel_topic",
    "add_reaction",
    "call_webhook",
    "request_approval",
    "delay",
}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def read_frontmatter(path: Path, errors: list[str]) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(errors, f"{path.relative_to(ROOT)}: missing YAML frontmatter")
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        fail(errors, f"{path.relative_to(ROOT)}: unclosed YAML frontmatter")
        return {}, text
    raw = text[4:end]
    body = text[end + 5 :]
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError as exc:
        fail(errors, f"{path.relative_to(ROOT)}: invalid YAML frontmatter: {exc}")
        return {}, body
    if not isinstance(data, dict):
        fail(errors, f"{path.relative_to(ROOT)}: frontmatter must be a mapping")
        return {}, body
    return data, body


def validate_manifest(errors: list[str]) -> dict:
    if not MANIFEST.exists():
        fail(errors, ".plugin/plugin.json is missing")
        return {}
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(errors, f".plugin/plugin.json: invalid JSON: {exc}")
        return {}

    for field in ("id", "name", "version", "description", "personas"):
        if field not in manifest:
            fail(errors, f".plugin/plugin.json: missing required pack field '{field}'")

    personas = manifest.get("personas", [])
    if not isinstance(personas, list) or not personas:
        fail(errors, ".plugin/plugin.json: personas must be a non-empty array")
    elif len(personas) != len(set(personas)):
        fail(errors, ".plugin/plugin.json: duplicate persona path detected")

    pack_instructions = manifest.get("pack_instructions")
    if pack_instructions and not (ROOT / pack_instructions).is_file():
        fail(errors, f".plugin/plugin.json: pack_instructions not found: {pack_instructions}")

    mcp_config = manifest.get("mcp_config")
    if mcp_config and not (ROOT / mcp_config).is_file():
        fail(errors, f".plugin/plugin.json: mcp_config not found: {mcp_config}")

    hooks_config = manifest.get("hooks_config")
    if hooks_config and not (ROOT / hooks_config).is_file():
        fail(errors, f".plugin/plugin.json: hooks_config not found: {hooks_config}")

    return manifest


def validate_personas(manifest: dict, errors: list[str]) -> tuple[int, set[Path]]:
    names: dict[str, Path] = {}
    claimed_skills: set[Path] = set()
    count = 0

    for declared in manifest.get("personas", []):
        path = ROOT / declared
        count += 1
        if not path.is_file():
            fail(errors, f"manifest persona does not exist: {declared}")
            continue
        if path.parent != ROOT / "agents" or not path.name.endswith(".persona.md"):
            fail(errors, f"{declared}: personas must be flat files under agents/*.persona.md")

        fm, body = read_frontmatter(path, errors)
        for field in REQUIRED_PERSONA_FIELDS:
            if not fm.get(field):
                fail(errors, f"{declared}: missing required persona field '{field}'")

        name = fm.get("name")
        if isinstance(name, str):
            if not VALID_NAME.match(name):
                fail(errors, f"{declared}: invalid agent name '{name}'")
            if name in names:
                fail(errors, f"duplicate agent name '{name}' in {declared} and {names[name].relative_to(ROOT)}")
            names[name] = path

        if not body.strip():
            fail(errors, f"{declared}: persona prompt body is empty")

        skills = fm.get("skills", []) or []
        if not isinstance(skills, list):
            fail(errors, f"{declared}: skills must be a list")
            continue
        for skill_ref in skills:
            if not isinstance(skill_ref, str):
                fail(errors, f"{declared}: skill reference must be a string")
                continue
            skill_path = (ROOT / skill_ref.removeprefix("./")).resolve()
            try:
                skill_path.relative_to(ROOT.resolve())
            except ValueError:
                fail(errors, f"{declared}: skill path escapes pack root: {skill_ref}")
                continue
            if not skill_path.is_dir():
                fail(errors, f"{declared}: referenced skill directory missing: {skill_ref}")
                continue
            skill_file = skill_path / "SKILL.md"
            if not skill_file.is_file():
                fail(errors, f"{declared}: referenced skill has no SKILL.md: {skill_ref}")
                continue
            claimed_skills.add(skill_path)

    return count, claimed_skills


def validate_skills(errors: list[str]) -> int:
    count = 0
    skills_root = ROOT / "skills"
    if not skills_root.is_dir():
        fail(errors, "skills/ directory missing")
        return count

    for skill_dir in sorted(p for p in skills_root.iterdir() if p.is_dir()):
        count += 1
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.is_file():
            fail(errors, f"{skill_dir.relative_to(ROOT)}: missing SKILL.md")
            continue
        fm, body = read_frontmatter(skill_file, errors)
        for field in REQUIRED_SKILL_FIELDS:
            if not fm.get(field):
                fail(errors, f"{skill_file.relative_to(ROOT)}: missing required skill field '{field}'")
        if fm.get("name") != skill_dir.name:
            fail(errors, f"{skill_file.relative_to(ROOT)}: name must match directory '{skill_dir.name}'")
        if not body.strip():
            fail(errors, f"{skill_file.relative_to(ROOT)}: skill body is empty")

    return count


def validate_workflows(errors: list[str]) -> int:
    count = 0
    workflows = ROOT / ".buzz" / "workflows"
    if not workflows.exists():
        return count
    for path in sorted(list(workflows.glob("*.yaml")) + list(workflows.glob("*.yml"))):
        count += 1
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            fail(errors, f"{path.relative_to(ROOT)}: invalid YAML: {exc}")
            continue
        if not isinstance(data, dict):
            fail(errors, f"{path.relative_to(ROOT)}: workflow root must be a mapping")
            continue
        if not str(data.get("name", "")).strip():
            fail(errors, f"{path.relative_to(ROOT)}: workflow name is required")
        trigger = data.get("trigger")
        if not isinstance(trigger, dict) or trigger.get("on") not in VALID_WORKFLOW_TRIGGERS:
            fail(errors, f"{path.relative_to(ROOT)}: invalid trigger.on; expected one of {sorted(VALID_WORKFLOW_TRIGGERS)}")
        steps = data.get("steps")
        if not isinstance(steps, list) or not steps:
            fail(errors, f"{path.relative_to(ROOT)}: steps must be a non-empty list")
            continue
        seen: set[str] = set()
        for step in steps:
            if not isinstance(step, dict):
                fail(errors, f"{path.relative_to(ROOT)}: each step must be a mapping")
                continue
            step_id = step.get("id")
            if not isinstance(step_id, str) or not re.match(r"^[A-Za-z0-9_]{1,64}$", step_id):
                fail(errors, f"{path.relative_to(ROOT)}: invalid step id {step_id!r}")
            elif step_id in seen:
                fail(errors, f"{path.relative_to(ROOT)}: duplicate step id '{step_id}'")
            else:
                seen.add(step_id)
            if step.get("action") not in VALID_WORKFLOW_ACTIONS:
                fail(errors, f"{path.relative_to(ROOT)}: invalid action '{step.get('action')}'")
            if step.get("action") == "send_message" and "text" not in step:
                fail(errors, f"{path.relative_to(ROOT)}: send_message step '{step_id}' requires text")
            if step.get("action") == "request_approval":
                if "from" not in step or "message" not in step:
                    fail(errors, f"{path.relative_to(ROOT)}: request_approval step '{step_id}' requires from and message")
    return count


def main() -> int:
    errors: list[str] = []
    manifest = validate_manifest(errors)
    persona_count, _ = validate_personas(manifest, errors)
    skill_count = validate_skills(errors)
    workflow_count = validate_workflows(errors)

    if errors:
        print("BUZZ PACK STRUCTURAL VALIDATION: FAILED")
        for item in errors:
            print(f"- {item}")
        return 1

    print("BUZZ PACK STRUCTURAL VALIDATION: PASSED")
    print(f"Registered personas: {persona_count}")
    print(f"Skill packages: {skill_count}")
    print(f"Buzz workflows checked: {workflow_count}")
    print("Next runtime-level check: buzz pack validate .")
    print("Inspect resolved config: buzz pack inspect .")
    return 0


if __name__ == "__main__":
    sys.exit(main())
