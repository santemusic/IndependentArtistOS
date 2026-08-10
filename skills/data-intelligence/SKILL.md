---
name: "data-intelligence"
description: "Artist-business data operations covering KPI governance, source lineage, data quality, dashboards, experiment design, attribution, analysis, insight generation and executive decision support."
---

# Data & Intelligence Operations

## Mission
Create a trustworthy measurement and learning layer for the Artist OS. Data exists to improve decisions, not to decorate reports.

## 1. Measurement contract
For every material goal define: Goal ID, business/artist outcome, primary KPI, baseline, target, measurement window, source, metric owner, reporting cadence and known limitations. Leading and diagnostic indicators must not silently replace the primary outcome.

## 2. KPI dictionary
Each KPI record includes: KPI ID, name, plain-language meaning, exact definition/formula, unit, source system, source field/query where available, aggregation level, time zone/window, update cadence, accountable owner, baseline, target, caveats and last validation date.

## 3. Metric hierarchy
Use four levels:
- Outcome metrics: direct expression of the artist/business goal.
- Leading indicators: earlier signals expected to relate to the outcome.
- Diagnostic metrics: explain where/why movement may be occurring.
- Health/guardrail metrics: detect undesirable side effects or operational failure.
Do not optimize a diagnostic metric as though it were the outcome.

## 4. Data lineage
For every reported number retain SOURCE → EXTRACTION/IMPORT → TRANSFORMATION → METRIC → REPORT/DECISION lineage when technically possible. Manual values must be labeled manual with source/date. Derived metrics must document formula.

## 5. Data quality gates
Check completeness, freshness, validity, uniqueness, consistency and identifier integrity. Classify quality as GOOD, DEGRADED, UNRELIABLE or UNKNOWN. An unavailable or unreliable metric is not zero. Never silently fill missing values.

## 6. Identifier architecture
Prefer stable IDs across systems: Goal ID, Project ID, Release ID, Song/Product ID, Content ID, Campaign ID, Experiment ID, Creator ID and Contact/CRM ID where lawful. Cross-agency measurement depends on identifiers surviving handoffs.

## 7. Dashboard design
Every dashboard must answer a decision question. Recommended executive structure: outcome vs target, trend, releases/projects at risk, audience/fan growth, content/growth signal, revenue/cost where available, anomalies, decisions required and data-quality warnings. Use exception-first reporting.

## 8. Release intelligence
At D1/D3/D7/D14/D28 where data exists, examine availability/incidents, consumption, saves/shares, listener/follower movement, source/context, territories, playlist/editorial outcomes, content contribution, campaign traffic, owned-fan capture and spend efficiency. Adjust for reporting delays and platform-definition differences.

## 9. Content intelligence
Link performance to Content ID and relevant attributes such as platform, format, hook/angle, duration, topic/pillar, CTA and campaign phase. Evaluate attention, completion/retention where available, engagement, profile/landing behavior and downstream conversion. Do not declare a creative winner solely from views.

## 10. Growth intelligence
Link Campaign ID, audience, Creative/Content ID, spend, destination and conversion events. Evaluate delivery cost, attention/click efficiency, landing conversion, owned capture, downstream listener/fan quality and repeat behavior as available. Report attribution assumptions explicitly.

## 11. Attribution
Treat attribution as a model, not ground truth. Label whether evidence is direct platform attribution, tagged-link attribution, last-touch, first-touch, modeled/inferred or qualitative. Avoid adding conversions from incompatible attribution systems as though they were unique people.

## 12. Experiment design
Before launch capture: Experiment ID, hypothesis, owner, independent variable, audience/context, comparison/control, primary metric, guardrail metrics, baseline, minimum useful effect where practical, planned duration/sample rationale, instrumentation, stop rule and decision rule. Change one major variable where causal learning is the purpose.

## 13. Experiment evaluation
Validate instrumentation first. Then compare observed effect with predefined rule and practical importance. Classify WIN, LOSS, INCONCLUSIVE or INVALID. Record result, uncertainty, confounders, interpretation, action and next test. Never rewrite the hypothesis after seeing results.

## 14. Insight generation
Use: OBSERVATION → EVIDENCE → INTERPRETATION → CONFIDENCE → IMPLICATION → ACTION → VERIFICATION. Confidence may be HIGH, MEDIUM or LOW with rationale. Include counter-evidence and alternative explanations for material decisions.

## 15. Anomaly protocol
When a material spike/drop occurs: verify source freshness → check tracking/schema changes → compare across independent sources if possible → segment by territory/platform/content/campaign → identify operational incidents → only then form causal hypotheses. Escalate suspected platform/distribution/tracking incidents to relevant CEO.

## 16. Forecasting
Forecasts must state method, inputs, assumptions, horizon and uncertainty range. Separate target from forecast. Do not present deterministic stream/revenue/audience predictions where the underlying system is volatile.

## 17. Executive intelligence brief
Return: what changed, why it matters, confidence, goal impact, strongest evidence, biggest risk, decision required, recommended action and what to watch next. Prefer a few material insights over exhaustive metric dumps.

## 18. Learning memory
Maintain a ledger of experiments, campaign lessons, content patterns, audience/territory insights, release benchmarks, failed assumptions and known measurement caveats. Reuse learning but revalidate when context changes.

## 19. Privacy and access
Use least-privilege access. Aggregate personal data whenever individual-level detail is unnecessary. Do not expose private fan/contact information in broad dashboards. Coordinate new personal-data use with Legal/CRM governance.

## 20. Definition of done
An analysis is DONE only when source/time window are stated, data quality is assessed, comparison context exists, observations are separated from inference, limitations are disclosed, the output is linked to a decision/action, and reproducible identifiers/query logic are retained where available.
