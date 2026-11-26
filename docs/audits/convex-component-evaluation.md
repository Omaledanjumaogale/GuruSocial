# Convex Component Evaluation Register

**Directory inspected:** https://www.convex.dev/components (categories reviewed: authentication, backend
utilities, AI, database/search, durable functions, messaging, storage, integrations, payments, analytics).
**Docs consulted:** components overview / using / understanding, `convex.config.ts`.
**Constraint:** Convex free tier; no plan upgrade available.

| Candidate area | Component class | Application need | Existing implementation | Decision | Reason |
|---|---|---|---|---|---|
| Auth | Official Convex Auth / third-party auth components | Session auth | Custom token + session table (`convex/auth.ts`) with OAuth identity linking (`oauthAccounts`) | **Retain** | Working, fully controlled, no migration risk; switching would invalidate existing sessions and require issuer configuration not available here |
| RBAC | Component-based permissions | Server-side role checks | New `convex/rbac.ts` (matrix + assertions) | **Retain custom** | The matrix is ~130 lines, auditable, and has no component dependency; a component would add a second source of truth |
| Rate limiting | Rate limiter component | Abuse protection on auth/API | Field-level validation + API-key scoping; no limiter yet | **Defer** | Needs a per-identity policy decision; recorded in the roadmap (P1) |
| Durable workflows / work pools | Workflow + workpool components | Publishing retries, long jobs | Post lifecycle with `perPlatformResults` + `attempts`; no queue worker | **Defer** | No provider adapters are enabled yet; adding a queue before real delivery exists would be dead infrastructure |
| Cron / scheduled jobs | Crons component | Digest + expired-token sweeps | Not implemented | **Defer (P2)** | Valuable, but must land with a notification-suppression policy |
| Aggregates / sharded counters | Aggregate component | Analytics rollups | On-demand aggregation in `analytics.ts` + 15 s client cache | **Reject for now** | Current volume is far below the point where aggregates pay for themselves |
| File storage | R2 integration | Media uploads | R2 presigned PUT (`convex/media.ts`), Convex stores metadata only | **Retain** | Meets the cost constraint: bulk bytes never transit Convex |
| Email | Resend integration | Welcome + operator test | `convex/email.ts` | **Retain** | Live and verified (Resend returned 200 with a message id) |
| AI agents | Agent component | Server-side generation | `convex/ai.ts` calling Agnes AI; deterministic local fallback | **Retain** | Keeps the browser free of keys; agent component would duplicate orchestration |
| Search / vector | Search components | Content search | Not needed by current routes | **Reject** | No user-facing search requirement |
| Payments | Payments component | Subscriptions | Plan field only; no billing flow | **Defer (P3)** | Requires a provider decision and webhook endpoint; out of scope of the current request |

## Conclusion

No third-party Convex component was installed. Every capability that this application actually needs is
either already implemented in-repo, satisfied by a native Convex feature, or deliberately deferred with a
documented precondition. Installing components without those preconditions would add dependencies, schema
footprints and failure modes without reducing cost or risk.

**Security review note:** had a component been adopted, the requirement was source inspection, license check,
dependency tree review, install-script review and a staging migration — none of which was needed here.
