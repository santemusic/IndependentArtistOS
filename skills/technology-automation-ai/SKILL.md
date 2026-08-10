---
name: "technology-automation-ai"
description: "Technical operating layer for multi-agent Artist OS: orchestration, Buzz-compatible personas/skills, integrations, automation, permissions, secrets, observability, evaluations, knowledge/memory and reliability."
---

# Technology, Automation & AI Infrastructure

## Mission
Turn the Agency architecture into a controlled executable multi-agent system in which goals become tasks, specialists use authorized tools, state persists, approvals are enforced, failures are observable and automation can be trusted incrementally.

## Architectural principle
The Artist OS is not one super-agent. It is a hierarchy of bounded agents with explicit skills, channels/events, tools, permissions, authoritative records and escalation paths. The runtime may evolve; business state and governance must remain portable.

## Stage 0 — Runtime inventory
Maintain runtime/version, repository/config source, enabled agents, enabled skills, communication model, connected tools/MCP servers/APIs, persistence layer, secret store, environments, deployment method and known runtime constraints. Separate DESIGNED, CONFIGURED, TESTED and PRODUCTION states.

## Stage 1 — Agent contract
Every agent must define: stable name, display name, mission, responsibilities, skill references, subscribed channel/event scope, trigger behavior, tools required, read/write permissions, authoritative objects it may update, prohibited actions, escalation owner and human approval gates.

## Stage 2 — Agency topology
Use Agency CEO → specialist agents. CEO coordinates cross-functional objectives; specialists perform bounded work. Cross-Agency dependencies route through explicit task/handoff records rather than relying on every agent reading every message.

## Stage 3 — Task envelope
Every routed task should support: TASK_ID, CORRELATION_ID, PARENT_TASK_ID, GOAL_ID, PROJECT_ID, requesting actor, assigned actor, action, inputs/references, expected output, deadline, priority, dependencies, risk class, approval requirement, state, retry count and result/evidence. Unknown fields remain explicit.

## Stage 4 — Task state machine
PROPOSED → VALIDATED → QUEUED → IN_PROGRESS → WAITING_DEPENDENCY / WAITING_APPROVAL → COMPLETED / FAILED / CANCELLED. A task is COMPLETED only when expected output/evidence exists. A message saying done is not sufficient for material external actions.

## Stage 5 — Orchestration
On event/goal: classify domain → select Agency CEO/specialist → fetch minimum relevant context → validate prerequisites → create task → enforce dependency/approval gates → invoke authorized tool/action → verify result → update authoritative state → emit downstream event. Prevent recursive self-trigger loops and fan-out storms.

## Stage 6 — Event model
Use stable event names where possible: goal.created, project.updated, music.master_approved, release.scheduled, content.approved, live.confirmed, partnership.signed, rights.cleared, finance.payment_confirmed, commerce.order_event and task.failed. Events contain IDs/references, not uncontrolled copies of sensitive records.

## Stage 7 — Idempotency
Every external write must have an idempotency strategy. Prefer native idempotency keys when available; otherwise maintain internal action key from workflow/object/action/version. Before retrying, query/verify remote state when possible. Never blindly retry send/publish/pay/delete/commit-like actions.

## Stage 8 — Integration registry
For every connector record SYSTEM_ID, purpose, Agency owner, technical owner, auth identity, environment, scopes, read/write objects, trigger mechanism, API/version, rate limits, data classification, source-of-truth direction, health and last verified. No undocumented production integration.

## Stage 9 — Data contracts
Define canonical IDs and schemas independent of vendor systems. External IDs map to internal IDs. Validate required fields, types, allowed states, timestamps/timezones and version. Preserve raw source reference for audit where appropriate. Schema changes require compatibility/migration plan.

## Stage 10 — Permissions
Default deny. Grant minimum tool/action scope per agent. Separate READ, DRAFT, CREATE, UPDATE, SEND/PUBLISH, DELETE, FINANCIAL, ADMIN. High-risk capabilities require explicit human/system authorization. Service identities should be unique enough for audit and revocation where platform supports it.

## Stage 11 — Secrets
Secrets never belong in persona files, SKILL.md, normal logs, prompts, issues or committed configuration. Use platform secret store/environment injection/approved vault. Track secret owner, system, purpose, environment, created/rotated/expiry metadata and revocation procedure without storing secret value.

## Stage 12 — Automation risk classes
R0 READ_ONLY: retrieve/summarize.
R1 INTERNAL_REVERSIBLE: create draft/internal task/tag.
R2 EXTERNAL_REVERSIBLE: create/update external record with reliable rollback.
R3 EXTERNAL_COMMUNICATION: send/publish/message.
R4 MATERIAL_COMMITMENT: contract, rights, major spend, booking acceptance.
R5 FINANCIAL/DESTRUCTIVE/PRIVILEGED: money movement, destructive deletion, credential/admin/security action.
Higher classes require stronger verification and approval; R4/R5 remain human-controlled unless a specific governed system delegates narrowly defined authority.

## Stage 13 — Workflow specification
Each automation requires: owner, purpose, trigger, preconditions, source records, steps, decision rules, tools, risk class, approvals, idempotency, retries, timeout, rollback/compensation, failure queue, observability, test cases and disable switch. If any critical field is undefined, automation remains DESIGN/DRAFT.

## Stage 14 — Human-in-the-loop gates
Approval request must state proposed action, why, exact external effect, object/counterparty, material terms/value where relevant, evidence, risks, deadline and what happens on approval/rejection. Approval is scoped to the specific action/version; material changes require reapproval.

## Stage 15 — Knowledge architecture
Separate: authoritative structured records; source documents/assets; derived summaries; ephemeral conversations. Retrieval should prefer authoritative records and current source evidence. Summaries carry generated timestamp and source references. Conflicts trigger reconciliation, not silent overwrite.

## Stage 16 — Memory policy
Durable memory stores operationally useful facts with provenance and owner. Do not persist unnecessary secrets or sensitive personal information. Define retention/archival/deletion policy. Agent conversational memory is never a substitute for authoritative state.

## Stage 17 — Observability
Emit structured events for workflow start/end, agent selection, tool call result, approval state, retry, failure and authoritative state change. Metrics: task throughput, completion rate, failure rate, retry rate, queue age, approval latency, integration error rate, end-to-end latency and model/tool cost where measurable. Use correlation IDs for traces.

## Stage 18 — Audit log
Material action log should include timestamp, actor/service identity, task/correlation ID, action, target, prior/new state where available, approval reference, tool/integration, result and evidence reference. Logs must redact secrets and minimize sensitive data.

## Stage 19 — Evaluation
Maintain offline test cases per skill/persona and workflow. Test routing accuracy, required-field detection, hallucination resistance, authoritative-source preference, permission compliance, approval enforcement, state transition correctness, duplicate prevention, tool failure and adversarial prompt/data. Regression-test changes before production.

## Stage 20 — Deployment lifecycle
DESIGN → LOCAL/SANDBOX → INTEGRATION_TEST → SHADOW where useful → LIMITED_PRODUCTION → PRODUCTION. Promote only with defined acceptance criteria. Maintain configuration version and rollback target. Never edit production behavior without traceable version control.

## Stage 21 — Reliability
Define SLOs appropriate to critical workflows, not blanket uptime theater. Use bounded retries, circuit breakers/disable switches, dead-letter queues and degraded-mode behavior. If source system is unavailable, preserve UNKNOWN/STALE state rather than inventing current data.

## Stage 22 — Incident response
DETECT → CLASSIFY → CONTAIN → PRESERVE EVIDENCE → COMMUNICATE → RECOVER → VERIFY → RESUME → POSTMORTEM → CORRECTIVE ACTIONS. Severity considers financial/legal/public impact, data exposure, duplicate/incorrect external action and business interruption. Do not destroy evidence during recovery.

## Stage 23 — Cost controls
Track model/tool/API usage where available. Route simple deterministic work to deterministic code/tools rather than expensive reasoning. Cache only where freshness and permissions allow. Set workflow budgets/limits for loops and retries. Cost optimization must not weaken critical controls.

## Stage 24 — Buzz implementation model
Represent each employee as a persona Markdown file with explicit skill reference and communication subscription. Represent reusable SOP/domain logic as skills. Use channels/events for coordination, but preserve business state in authoritative records/templates/integrations rather than relying only on conversation history. Treat Buzz runtime-specific capabilities as version-dependent and verify before implementing assumptions.

## Stage 25 — Cross-Agency automation examples
Release master approved → Legal rights gate → Release metadata/delivery → Content/Growth/PR schedule.
Live confirmed → Legal/Finance gate → Tour advance → Growth geo campaign → Content capture → Settlement.
Partnership signed → activation tasks → Content/Live/Growth → proof → Finance invoice milestone.
Commerce low-stock signal → inventory review → reorder proposal → Finance approval → sourcing workflow.
Professional meeting logged → CRM commitments → follow-up queue.

## Production readiness gate
GREEN only when agent/skill exists, required integration is configured, permissions are least-privilege, secrets are externalized, source-of-truth defined, workflow has idempotency/failure handling, approval gates are enforced, evals pass, observability exists and rollback/disable path is known. Otherwise AMBER/RED.

## Integrity and security controls
Never invent external-system success. Never expose credentials. Never bypass approval. Never give one agent unrestricted admin access by default. Never allow stale memory to override authoritative records. Never retry irreversible actions blindly. Never silently drop failed work. Human authority remains final for material commitments.
