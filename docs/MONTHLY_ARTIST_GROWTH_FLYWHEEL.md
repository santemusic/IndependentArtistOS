# Monthly Artist Growth Flywheel — Operating Contract (v1)

The repository stores software, reusable workflow definitions and task templates. **Notion holds live tasks and artist data.** Do not mistake an empty Notion table for missing GitHub code, or populate it with invented live artist records.

## One recurring artist cycle

1. **Release and readiness:** decide which title, validate splits/rights, delivery, budget, release timeline and approvals.
2. **Capture title data:** streaming listeners/saves/streams, sources, countries/cities, follower conversion, links/UTMs and a baseline before campaign launch.
3. **Content:** produce multiple angles from the title, publish approved assets organically and measure creative-level engagement.
4. **Meta Ads:** use approved creatives and budget for bounded tests, compare performance to real outcomes, stop/scale based on preagreed thresholds.
5. **Growth:** identify high-signal audiences, markets, platforms and effective creative/channel combinations.
6. **Promoter and PR outreach:** select promoters, venues, press and curators by demonstrated interest; prepare tailored pitches and EPK. Require human approval for external sensitive outreach.
7. **Bookings and revenue:** manage pipeline from lead → contact → response → hold → offer → signed deal → show → invoice → payment; report expected vs contracted vs received revenue separately.
8. **Analyze, forecast, repeat:** consolidate audience/creative/ads/booking/financial data and produce base/best/worst scenarios. Decide next month's single/track, spend, priorities and experiments.

Release, content, ads and outreach can overlap; they do not need to wait for all earlier phases to finish. Revenue may lag releases by months; do not claim guaranteed causality between ads and bookings.

## Canonical Notion templates

Source table: **Artist OS Tools 2.0 → 00 — AI MANAGER COMMAND CENTER → Management Tasks**
(`8cde002082364837a3f8f1566f3cf950`).

The 10 reusable entries carry fingerprints `template:monthly-artist-growth:v1:01` through `:10`, **no Artist ID**, no due dates, and `Status=Not Started`. They are NOT artist-specific jobs. Create a new scoped task instance only after authenticating and selecting a real Artist Master Context row; never re-label shared templates as if they belong to a specific artist.

## Multi-artist task materialization

- Confirm authenticated OAuth principal's ACL for requested Artist Master Context page ID.
- Generate idempotency key `artist:<artist-page-id>:cycle:<YYYY-MM>:workflow:v1:step:<01..10>`.
- Search same fingerprint **and** artist ID before inserting, to avoid duplicate cycles.
- Persist `Artist ID`, fingerprint, source agent, owner, next action, priority, status, and a real due date once confirmed.
- Select source pages for release, content, ads, bookings and finance under this artist only; refuse ambiguous cross-artist links.
- Keep manual approvals for rights, public posting, paid ads, financial commitments, contracts and sensitive outreach.
- Each month close out confirmed outcomes, snapshot KPI and financial actuals, then create the next cycle without overwriting human decisions.
- Audit every write; ignore templated rows and unscoped legacy rows when rendering a given artist's operating snapshot.

## Measurement taxonomy

Track ID, Artist ID, campaign and creative IDs, timestamp, source, region, spend with currency, impressions, reach, plays/streams, saves, listeners, followers, leads, positive promoter responses, bookings offered/confirmed, invoiced and paid amounts. Attribute only where data supports it; mark missing data and estimates explicitly.

## Operational state

Notion Task templates are now inserted. Automatic recurring execution, provider data syncing and cross-platform posting are **not** enabled simply by the presence of these entries. All external action gates remain supervised.
