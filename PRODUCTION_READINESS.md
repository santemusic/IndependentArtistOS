# Independent Artist OS — Production Readiness Gate

## Release state

- Architecture version: `1.0.0-rc.1`
- Architecture build: COMPLETE
- Runtime production certification: PENDING
- Active deployment scope: Wave 1
- Human principal: Artist / Chairperson
- Runtime target: Buzz Persona Pack

`1.0.0-rc.1` means the architecture is frozen for production validation. It does **not** mean the live runtime has passed production acceptance.

## Definition of v1.0.0

The repository may be promoted from `1.0.0-rc.1` to `1.0.0` only after every mandatory gate below has evidence.

### Gate A — Repository integrity
- [x] Persona Pack manifest exists.
- [x] Wave-1 personas are explicitly registered.
- [x] Shared pack instructions exist.
- [x] Agency skills exist.
- [x] Structural validation script exists.
- [x] GitHub Actions structural validation exists.
- [x] Sandbox release test fixture exists.
- [x] Integration registry exists.
- [x] No production credential is intentionally committed by the architecture.
- [ ] Latest CI structural-validation run confirmed passing.

### Gate B — Official Buzz conformance
- [ ] `buzz pack validate .` passes on target Buzz version.
- [ ] `buzz pack inspect .` resolves the intended 12 Wave-1 personas.
- [ ] Skill discovery/load behavior is verified in the actual runtime.
- [ ] No unsupported MCP transport/config is enabled.
- [ ] Buzz version used for certification is recorded.

### Gate C — Sandbox acceptance
- [ ] `TEST_RELEASE_001` executed in target Buzz runtime.
- [ ] Grounding score passes.
- [ ] Routing score passes.
- [ ] Authority score passes.
- [ ] State-integrity score passes.
- [ ] Multi-agent behavior score passes.
- [ ] Executive-output score passes.
- [ ] No automatic-fail condition occurred.
- [ ] Observed defects are fixed or explicitly accepted.

### Gate D — Security and permissions
- [ ] Secrets are supplied outside Git.
- [ ] Each enabled integration has an owner.
- [ ] Each enabled integration has least-privilege scopes.
- [ ] R4/R5 actions have explicit human approval gates.
- [ ] External writes are verified after execution.
- [ ] Destructive actions have rollback/compensation procedures.
- [ ] Production identities are separate from unnecessary personal/admin credentials where practical.
- [ ] Logs redact credentials and sensitive tokens.

### Gate E — Operational reliability
- [ ] Agent-loop test passes.
- [ ] Duplicate/idempotency test passes for automated writes.
- [ ] Integration outage behavior is tested.
- [ ] Permission-denied behavior is tested.
- [ ] Unknown/conflicting source-data behavior is tested.
- [ ] Human rejection path is tested.
- [ ] Stop/disable procedure is tested.
- [ ] Incident owner is identified.

### Gate F — First live project
- [ ] One controlled real project has an authoritative Goal ID.
- [ ] Real project owner and supporting Agencies are assigned.
- [ ] Rights state is sourced rather than inferred.
- [ ] Budget state is sourced rather than inferred.
- [ ] External actions are individually authorized according to risk.
- [ ] Post-project outcome review is completed.

## Production invariants

These rules cannot be waived silently:

1. Human approval is never inferred from silence.
2. `UNKNOWN` is a valid state and must not be converted to GREEN without evidence.
3. A task being complete does not prove the business goal was achieved.
4. Chat is not the authoritative database for rights, cash, contracts, distribution state or external execution.
5. No agent may claim an external action succeeded without remote-state evidence.
6. Automation authority cannot exceed the requesting Agency's business authority.
7. Material legal, financial, rights, publishing, destructive and privileged actions remain gated.
8. One outcome has one primary accountable owner.
9. Agent-to-agent escalation must terminate at a defined authority boundary.
10. Production secrets do not belong in the repository.

## Release freeze policy

Until v1.0.0 certification:
- do not add new Agencies merely for completeness;
- do not activate the full specialist workforce;
- prioritize defect correction over architecture expansion;
- keep Wave-1 triggers conservative;
- do not enable high-risk integrations before their controls are tested.

## Go / no-go record

- Candidate commit/tag:
- Buzz version:
- Validator result:
- Sandbox score:
- Security reviewer/owner:
- Operations reviewer/owner:
- Human Artist approval:
- Open P0 blockers:
- Open P1 blockers:
- Decision: GO / CONDITIONAL GO / NO-GO
- Decision date:
- Evidence links:

## Promotion procedure

When all mandatory gates pass:

1. Update `.plugin/plugin.json` version from `1.0.0-rc.1` to `1.0.0`.
2. Record the certified Buzz version and sandbox result in this file.
3. Create a Git tag/release for `v1.0.0`.
4. Pin production installation to the reviewed tag/revision.
5. Keep later architecture changes behind normal review and revalidation.

## Current conclusion

**Architecture: DONE. Production certification: NOT YET CLAIMED.**

There is no Step 23 required to finish the architecture. Remaining work is runtime validation, account authorization, controlled deployment, defect correction and normal product iteration.
