# Step 21 — Real Integrations & Tool Access

## Objective

Connect the Artist OS to real business systems without turning the agent network into an unrestricted system user.

**Important:** Step 20 runtime PASS is the production gate. This repository can define Step 21 now, but real external writes must not be enabled until the Wave-1 sandbox test has actually passed.

## Buzz integration model

Current Buzz Persona Pack documentation supports MCP servers at two levels:

1. pack-level `.mcp.json` shared across agents;
2. per-persona `mcp_servers` frontmatter for agent-specific servers.

Buzz merges the two sets and passes them to the runtime. Current supported transports are `stdio` and `streamable_http`; SSE must not be used.

The repository contains `.mcp.example.json`, not a live `.mcp.json`, because no real server command, endpoint, credential mechanism or scope should be invented before the operator selects the actual services.

## Critical secret-handling note

Do not commit API keys, OAuth refresh tokens, passwords, private keys or bank credentials.

Buzz's current Persona Pack specification notes that MCP `${VAR_NAME}` interpolation is planned but not yet implemented at the harness layer. Therefore do not assume a literal `${TOKEN}` in pack config will be resolved by Buzz. Verify how the selected runtime/MCP server receives secrets before activation.

## Integration order

### Wave A — read-only context
Enable first after Step 20 PASS:

- Calendar: read events/availability.
- Email: search/read only.
- Cloud drive: authorized search/read.
- DSP/music analytics: read performance data.
- Social analytics: read posts/metrics.
- Fan CRM: read segments/campaign metrics.
- Professional CRM: read contacts/history.
- Finance/accounting: read-only financial data where appropriate.
- Ecommerce: read orders/inventory/products.

Purpose: make agents useful with minimal external-action risk.

### Wave B — reversible internal/draft writes
After Wave A evaluation:

- create email drafts;
- create internal CRM notes/tasks;
- create controlled project folders;
- create draft campaigns;
- create draft commerce products;
- create/update internal project records;
- controlled calendar-event creation where approved.

### Wave C — external communications/publishing
Only after explicit approval workflow tests:

- email sends;
- CRM campaign sends;
- approved social scheduling/publishing;
- approved professional outreach.

### Wave D — material actions
Keep human-controlled:

- distributor release submission/edit/takedown;
- contract acceptance/signature;
- rights transfer/license commitments;
- major purchase/inventory commitments;
- refunds/material payment actions;
- money movement;
- bank/payment-instruction changes;
- tax filings;
- destructive/admin/security actions.

## Per-integration onboarding contract

Before any integration is enabled, record:

- Integration ID
- Business owner
- Technical owner
- Vendor/system
- Environment
- Authentication mechanism
- MCP/API/connector implementation
- Transport (`stdio` or `streamable_http` for Buzz MCP)
- Exact read scopes
- Exact write scopes
- Source-of-truth objects
- Data classification
- Risk class
- Approval requirements
- Idempotency strategy
- Rate limits
- Health check
- Failure behavior
- Audit evidence
- Credential rotation/revocation owner
- Sandbox test result
- Production activation decision

Use `system/INTEGRATION_REGISTRY.yaml` as the portfolio registry.

## Permission model

Do not give every CEO every integration.

Recommended ownership:

| System | Primary owner | Initial mode |
|---|---|---|
| GitHub | Automation | controlled R/W |
| Calendar | Operations | read-first |
| Email | Relationships / Executive | read + draft first |
| Drive | Operations | read-first |
| Distributor | Release | read-first / human submit |
| DSP analytics | Data | read-only |
| Social | Growth | analytics first |
| Fan CRM | Growth | read-first |
| Professional CRM | Relationships | read-first |
| Accounting | Finance | read-only first |
| Ecommerce | Commerce | read-first |

Where Buzz supports a per-persona MCP configuration, prefer agent-specific access over globally sharing a high-risk server.

## Data minimization

Agents should retrieve only the context required for the current task. Do not automatically inject entire mailboxes, contact databases, financial ledgers, contracts or drives into every agent session.

## Source-of-truth rule

External systems remain authoritative for their own objects unless an explicit synchronization contract says otherwise.

Examples:

- Calendar is authoritative for scheduled events.
- Distributor is authoritative for delivery state.
- Accounting/bank source is authoritative for actual transactions/balances.
- Ecommerce platform is authoritative for order/payment state.
- CRM is authoritative for campaign send state.

A model summary is never allowed to override an external authoritative record.

## External write contract

Before an agent writes externally:

1. validate source record;
2. validate permission;
3. validate approval requirement;
4. create idempotency/action key;
5. show exact intended effect for material actions;
6. execute through the authorized tool;
7. inspect tool response;
8. verify remote state where practical;
9. record evidence;
10. emit downstream event only after verification.

`tool call attempted` is not `action completed`.

## Integration smoke-test pattern

For each system:

### Test 1 — connectivity
Read a harmless test object.

### Test 2 — scope boundary
Request an action outside granted scope. Expected: denied/not available.

### Test 3 — unknown state
Request missing data. Expected: UNKNOWN/not found, not fabrication.

### Test 4 — controlled write
For Wave B+, create a reversible sandbox object.

### Test 5 — verification
Confirm the object exists in the external system and matches the requested state.

### Test 6 — duplicate
Repeat the same logical action. Expected: idempotent behavior or duplicate warning, not uncontrolled duplication.

### Test 7 — failure
Simulate/observe permission denial, timeout or invalid input. Expected: visible failure and no false success.

## Production gate per integration

GREEN only when:

- Step 20 runtime test passed;
- integration owner exists;
- authentication works without secrets in Git;
- scopes are least-privilege;
- authoritative objects are documented;
- read smoke tests pass;
- writes, if enabled, have approval/idempotency/verification controls;
- failures are observable;
- revocation path is known;
- agent evaluation passes.

Otherwise remain AMBER/RED and do not enable production writes.

## What Step 21 does not do

This step does **not** invent or silently provision credentials, distributor access, social tokens, finance access, CRM accounts or third-party MCP servers. Those require the actual operator-selected services and authorization.

## Step 21 completion definition

Repository architecture is complete when the integration registry, permission rollout, MCP example and activation gates are committed.

Operational Step 21 completes incrementally as each real integration is authenticated, tested and promoted through read-only → reversible writes → approved external actions according to its risk.
