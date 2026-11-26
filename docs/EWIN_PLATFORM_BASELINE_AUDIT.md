# GuruSocial — E-WIN Platform Baseline Audit

Prepared: 26 November 2026. Baseline for the E-WIN platform upgrade (master
implementation prompt). Commit at audit time: `main` @ 16f47ea (production
deployment `gurusocial` on Cloudflare Pages, custom domain
`https://gurusocial.ewinproject.org`; Convex backend `beaming-bobcat-890`, eu-west-1).

## Application identity

- **Name/brand:** GuruSocial — harmonized enterprise social media command center.
- **Stack:** SvelteKit (static adapter) + Tailwind CSS v4 + Convex + Cloudflare Pages (PWA).
- **Version:** v1.2.0 (design system v2: Sora/Inter, true-black dark theme + white light theme, sky/emerald/red/white accents).
- **Ecosystem:** registered in `Omaledanjumaogale/E_WIN_Project_Ecosystem` (`config/application-repositories.json`, ecosystemApplications list).

## Routes & navigation

- Public: `/`, `/pricing`, `/docs`, `/auth` (+ OAuth callbacks, hub-session redeem).
- Authenticated user: `/dashboard` + 21 sub-pages (overview, composer, calendar, posts, approvals, inbox, messages, notifications, analytics, reports, listening, agents, studio, CRM, campaigns, channels, media, ecosystem, integrations, developer, team, settings).
- Super-admin: `/console` (Overview, Users, Roles & access, Messages, Broadcast, Audit, System).
- Internal services: `/api/v1/posts` (key), `/mcp` (MCP JSON-RPC), `/integrations/ewin/{link,session,identity,report,revoke}` (HMAC-signed hub channel), `/oauth/{google,github}/callback`.
- Detail: `docs/EWIN_PLATFORM_FEATURE_ROUTE_MATRIX.md`.

## Authentication & roles

- Native email/password sessions (Convex `sessions` table) + Google/GitHub OAuth (server-side exchange) + hub-issued session redeem (`ewinAuth.provisionFromHub`, canonical subject `users.ewinHubUserId`).
- RBAC: `owner | admin | approver | member` with permission checks (`src/lib/auth/rbac.ts`, `convex/rbac.ts`) enforced server-side on every mutation.
- Super admin: `/console` credential sign-in → server-side `adminSessions` (12 h). Console presence in the UI is conditional on that server-issued token.

## Billing & money

- **No local payment route exists** — charges were never collected on this platform, so there is no second gateway to remove.
- Plans (`users.plan`) and the ₦ pricing page are preserved; hub policy v3.1 retires new subscription sales — reconciliation documented in the gap report.
- Central wallet bridge implemented (`convex/ewinWallet.ts` + `convex/billing.ts`): kobo integers, idempotency keys, quote(120 s) → in-app caution pop-up → hold → execute → release(`resultId`) / refund, super-admin exemption server-side, local `ewinWalletRefs` are references only. Pending hub-side: platform registration, service key, harmonization.

## AI

- Model-backed drafts server-side via the Agnes AI hub (`convex/ai.ts`), key in encrypted Convex env, deterministic offline fallback. Central model registry: not yet exposed by the hub — adapter boundary isolated in one module (gap report).

## PWA & responsiveness

- Manifest + versioned icons + service worker (network-first navigations, immutable assets, purge on update), install prompt, iOS guidance, offline fallback panel, `must-revalidate` HTML headers (stale-shell fix). Mobile drawer + bottom bar, safe-area insets, reduced-motion, touch targets ≥ 40 px.

## Data honesty

- Live Convex provider is the production default; the bundled demo provider activates **only** when the backend is unreachable and is explicitly labelled ("Demo data" chip, backend badge) — per the owner's standing instruction to retain mock data purely as a fallback. Honest empty/loading/error states on every page.

## Tests & quality gates

- `svelte-check` 0 errors, `tsc` (convex) 0 errors, static build with per-route HTML shells (27), REST/MCP/admin/OAuth/identity E2E verified live, wallet bridge fail-closed paths implemented.

## Risks

1. Hub-side platform registration + `EWIN_WALLET_KEY_GURUSOCIAL` provisioning outstanding (billing stays free/degraded until then — by design, not a claim of verified settlement).
2. Hub identity endpoint registration outstanding (`/integrations/gurusocial/identity` 404).
3. MFA/step-up awaits a central identity contract.
4. OAuth redirect URIs still need registration in the Google/GitHub consoles (owner action).
