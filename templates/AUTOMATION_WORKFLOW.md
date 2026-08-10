# Automation Workflow — {{WORKFLOW_NAME}}

## Control
- Workflow ID:
- Goal/Project ID:
- Business owner:
- Technical owner:
- Version:
- Environment: DESIGN / SANDBOX / TEST / LIMITED_PRODUCTION / PRODUCTION
- Risk class: R0 / R1 / R2 / R3 / R4 / R5
- Status:
- Last verified:

## Purpose
- Business outcome:
- Why automate:
- Manual SOP/source:
- Success criteria:
- Out of scope:

## Trigger
- Trigger/event:
- Trigger source:
- Frequency:
- Event schema/version:
- Correlation ID source:

## Preconditions
- Required authoritative records:
- Required fields:
- Required integration health:
- Required rights/legal state:
- Required financial state:
- Required human approval:

## Routing
- Requesting agent:
- Agency CEO:
- Specialist agent(s):
- Escalation owner:

## Workflow
| Step | Actor | Action | Tool/System | Input | Expected result | Risk | Failure behavior |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |

## State machine
- Initial state:
- Valid states:
- Completion evidence:
- Failure state:
- Cancellation behavior:

## External integrations
| System | Direction | Auth identity | Required scope | Object/API | Source of truth | Health check |
|---|---|---|---|---|---|---|
| | | | | | | |

## Permissions
| Agent | Tool | READ | DRAFT | CREATE | UPDATE | SEND/PUBLISH | DELETE | ADMIN |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Secrets
- Secret manager/environment mechanism:
- Credential owner:
- Rotation metadata location:
- Secret values committed to repo: MUST BE NO

## Human approval gate
- Approval required:
- Approver:
- Exact action being approved:
- Approval expires/invalidates when:
- Reapproval conditions:

## Idempotency
- Idempotency/action key:
- Duplicate detection:
- Remote-state verification before retry:

## Retry / timeout
- Retryable failures:
- Max retries:
- Backoff:
- Timeout:
- Non-retryable failures:

## Rollback / compensation
- Reversible action:
- Rollback method:
- Compensation method if irreversible:
- Disable/kill switch:

## Failure queue
- Dead-letter/escalation destination:
- Required failure context:
- Human response SLA/expectation:

## Knowledge / memory
- Authoritative source:
- Durable state written:
- Derived summary written:
- Retention:
- Sensitive-data restrictions:

## Observability
- Logs/events:
- Metrics:
- Trace/correlation:
- Alerts:
- Audit requirements:
- Redaction requirements:

## Evaluation suite
- [ ] Happy path
- [ ] Missing required input
- [ ] Conflicting source data
- [ ] Permission denied
- [ ] Integration unavailable
- [ ] Timeout
- [ ] Duplicate event
- [ ] Retry safety
- [ ] Human rejection
- [ ] Unsafe/adversarial input
- [ ] Rollback/compensation
- [ ] Authoritative-state verification

## Deployment
- Sandbox result:
- Integration-test result:
- Shadow/limited-production result:
- Production acceptance criteria:
- Current config/commit version:
- Rollback version:

## Incident runbook
- Severity criteria:
- Immediate containment:
- Evidence to preserve:
- Communications owner:
- Recovery verification:
- Resume authority:

## Production readiness
| Control | Status | Evidence |
|---|---|---|
| Agent + skill defined | | |
| Integration configured | | |
| Least privilege | | |
| Secrets externalized | | |
| Source of truth defined | | |
| Idempotency defined | | |
| Failure handling defined | | |
| Human gates enforced | | |
| Evaluations passing | | |
| Observability active | | |
| Rollback/disable path | | |

- Readiness: GREEN / AMBER / RED
- Blocking items:
- Next action:
- Owner:
