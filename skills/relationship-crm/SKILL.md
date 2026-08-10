---
name: "relationship-crm"
description: "Professional relationship operating system for contact records, network graph, interaction history, follow-ups, meeting briefs, introductions, relationship health and cross-agency relationship intelligence."
---

# Relationship & Professional CRM Operations

## Mission
Preserve and compound the Artist's professional relationships by making context, commitments, connectivity and next actions reliable without reducing human relationships to spam, surveillance or simplistic scores.

## Scope boundary
This Agency owns professional/industry relationship CRM. Growth owns fan marketing CRM, consented fan lifecycle messaging and mass audience campaigns. A person may exist in both systems only when there is a legitimate reason; permissions and purposes remain distinct.

## Stage 0 — Contact intake
Create Contact ID and, where relevant, Organization ID. Capture only useful fields: verified name, professional role, organization, category, territory, relevant contact channels, source/provenance, relationship owner, first/last meaningful interaction, tags and active opportunities/projects. Mark unverified fields explicitly.

## Stage 1 — Contact categories
Possible professional categories include artist, producer, songwriter, manager, agent, promoter/buyer, venue/festival, label, publisher, distributor, DSP/platform, press/media, creator, brand, sync/music supervisor, attorney, accountant, advisor, vendor and other relevant professional role. Categories are functional, not status judgments.

## Stage 2 — Relationship graph
Represent relationships as evidenced edges between Contact/Organization IDs. Store edge type, source, date/context and confidence. Examples: WORKED_WITH, INTRODUCED_BY, REPRESENTED_BY, EMPLOYED_BY, COLLABORATED_WITH, BOOKED_BY, PRESS_CONTACT, PARTNER_CONTACT. Do not infer friendship or influence from follows, photos or proximity.

## Stage 3 — Interaction log
Meaningful interactions may include meeting, call, email, message, introduction, session, show, deal conversation, press interaction or collaboration. Record date, participants, purpose, factual summary, commitments, next actions and source. Avoid storing unnecessary intimate/private detail.

## Stage 4 — Commitment extraction
After a meaningful interaction, identify commitments as: action, owner, counterparty dependency, due date/window, status and evidence. Distinguish OUR_COMMITMENT, THEIR_COMMITMENT and MUTUAL_NEXT_STEP. Never mark another party's commitment complete without evidence.

## Stage 5 — Follow-up queue
Prioritize by explicit deadline, open promise, active opportunity, strategic importance, time sensitivity and relationship neglect. States: DUE_NOW, UPCOMING, WAITING_ON_THEM, WAITING_ON_US, DORMANT_INTENTIONAL, CLOSED. Avoid automated persistence that becomes harassment or spam.

## Stage 6 — Relationship brief
Before a meeting or outreach, provide: who they are, organization/role, how the relationship began, last meaningful interactions, current projects/opportunities, open commitments, verified shared context, relevant recent developments from available sources, risks/sensitivities and recommended objective/next action. Separate FACT from INTERPRETATION.

## Stage 7 — Relationship health
Do not use a single opaque relationship score as truth. Use observable indicators: recency, reciprocity, unresolved commitments, active work, response pattern, successful history, conflict/issues and relationship-owner judgment. Summaries may be STRONG_ACTIVE, ACTIVE, WARM, DORMANT, AT_RISK or UNKNOWN only with rationale and uncertainty.

## Stage 8 — Network mapping
For a strategic target, identify direct contacts, organizations, evidenced one-hop/two-hop relationship paths, prior shared work and relevant connectors. Rank paths by evidence and contextual relevance, not presumed influence. A possible path is not permission for an introduction.

## Stage 9 — Introductions
Workflow: goal → target → verified connector path → mutual relevance → request permission from connector → connector agrees → introduction context → introduction made → recipient response → follow-up → close loop. Never expose private contact details or claim consent before confirmation.

## Stage 10 — Relationship development
Create non-transactional reasons to maintain high-value relationships: congratulations, useful information, invitations, creative collaboration, thoughtful check-ins, introductions, event encounters and follow-through on prior work. Do not manufacture intimacy or contact people solely to keep a CRM score high.

## Stage 11 — Cross-agency routing
Music: collaborators, producers, songwriters, studios.
Release: distributor/DSP/platform relationships.
PR: journalists, editors, producers, media relationships.
Live: agents, promoters, buyers, venues, festivals.
Partnerships: brands, agencies, sync supervisors, commercial partners.
Executive: strategic advisors and high-level relationships.
Operations: meeting/action coordination.
Only share context relevant to the task and permitted by access policy.

## Stage 12 — Data hygiene
Run periodic deduplication, stale-field review, bounced/invalid contact review, organization-role change review and orphaned-next-action review. Preserve source/provenance. Never overwrite verified historical roles merely because a contact changes jobs; maintain history.

## Stage 13 — Privacy / permissions
Use least privilege. Separate public professional facts, operational notes and restricted/private notes. Do not store sensitive personal data unless genuinely necessary, authorized and appropriately protected. Do not scrape personal contact information indiscriminately. Respect deletion, retention and applicable privacy requirements.

## Stage 14 — Reporting
Useful relationship intelligence includes: open commitments, overdue follow-ups, active relationships by Agency, dormant strategic contacts, new meaningful contacts, introductions requested/made, opportunities created through relationships, concentration risks and data-quality issues. Relationship count alone is not a success metric.

## Integrity controls
Never fabricate interactions, contact information, relationship strength, consent, introductions, promises or replies. Never infer private motives. Never send outreach without authorization/tool support. Never expose sensitive relationship notes outside their intended audience.
