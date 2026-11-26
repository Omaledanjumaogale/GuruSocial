# Improvement Roadmap

Estimates are ranges, not measured facts. Dependencies and acceptance criteria are explicit.

## P0 — Immediate
_(none open: the blank-page, sign-in, static-delivery and backend-deployment incidents are resolved and verified.)_

## P1 — Required for reliable core functionality

| # | Task | Depends on | Acceptance criteria | Risk | Effort |
|---|---|---|---|---|---|
| 1 | Register OAuth redirect URIs in Google Cloud + GitHub and complete one real round-trip per provider | Provider console access | A user signs in with Google and GitHub; session lands on `/dashboard`; no `redirect_uri_mismatch` | Low | 30–60 min |
| 2 | Apply `assertPermission` to legacy mutations (`posts.approve`, `posts.remove`, `keys.createKey`, `crm.*`) | RBAC module (done) | An `approver` can approve; a `member` receives `Forbidden`; verified by test | Medium (behaviour change) | 3–5 h |
| 3 | Negative authorization tests for messaging (non-participant cannot read/write) | Test harness | Automated test fails closed for foreign conversation ids | Low | 2–4 h |
| 4 | Byte cap + JSON schema validation on `POST /api/v1/posts` | — | 1 MB body rejected with 413; invalid platform rejected with 400 | Low | 1–2 h |
| 5 | Rate limiting on `auth.signIn`, `auth.signUp`, `/api/v1/*` | Component or per-key counters | 10 failed logins/min blocked; documented policy | Medium | 4–8 h |

## P2 — High-value performance / maintainability

| # | Task | Acceptance criteria | Effort |
|---|---|---|---|
| 6 | Move analytics rollups to scheduled materialised summaries; frontend reads the summary only | Overview query returns in one document read; egress measurably lower | 1–2 d |
| 7 | Batch seed/import writes (currently ~120 sequential inserts per workspace) | New workspace seeds in a single transaction under Convex limits | 4–6 h |
| 8 | Publishing worker with retries/idempotency per platform | Failed delivery retried with backoff, no duplicate posts | 2–3 d |
| 9 | Digest email + expired-token sweep on a cron, respecting notification preferences | Cron runs; opt-out users receive nothing | 4–8 h |
| 10 | Serve large report exports from R2 instead of Convex documents | Export URL points at R2; Convex stores only the pointer + metadata | 1 d |

## P3 — Optional enhancements

| # | Task | Notes |
|---|---|---|
| 11 | Convert operator session to an httpOnly cookie | Needs a server route; the current host is static-only. Would require a Worker or a Convex HTTP endpoint that sets the cookie |
| 12 | Subscription billing with a verified provider webhook | Requires a provider decision; never activate entitlements from a success redirect |
| 13 | Web push notifications | VAPID keys server-side, device subscription table, per-user removal |
| 14 | SPA rewrite for invented deep links | Investigate why `_redirects` splat is not applied on this project; the 404 recovery page is the current fallback |
| 15 | Visual regression screenshots at 320/390/768/1024/1440/1920 | Playwright + committed baselines |

## Accepted risks

- Operator token in `localStorage` (SEC-004) — accepted for a static host; documented.
- Unknown paths return the recovery page rather than the app shell — accepted; all real routes have shells.
- Demo data seeds alongside live data on first sign-in — intentional per the product brief ("mock data auto-replaced by real data").
