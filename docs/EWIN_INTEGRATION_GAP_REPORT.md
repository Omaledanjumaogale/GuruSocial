# GuruSocial — E-WIN Platform Integration Gap Report

Prepared: 26 November 2026. Companion to `EWIN_PLATFORM_BASELINE_AUDIT.md` and
`EWIN_PLATFORM_FEATURE_ROUTE_MATRIX.md`. States the verified status of every
master-prompt requirement: **connected** (verified with evidence), **configured**
(built and deployed, pending external input), or **missing** (adapter boundary
only, exact blocker named).

| # | Requirement | Status | Evidence / exact blocker |
|---|---|---|---|
| 1 | User View / Admin Console switch in header | **connected** | `Shell.svelte` renders "⚿ Admin Console" only when a server-issued admin session token exists (`adminSessions` table; every admin query/mutation re-verifies it server-side). "Return to User View" link in the console header. |
| 2 | Protected super-admin console | **connected** | `/console` sign-in against `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` env, 12 h server sessions in `adminSessions`; all admin operations call `adminOps.*` with `adminToken` verified server-side. Console modules: Overview, Users, Roles & access, Messages, Broadcast, Audit, System. |
| 3 | Header Home navigation | **connected** | "⌂" Home control in the topbar of every authenticated view; footer links on public pages. |
| 4 | Header dark/light toggle | **connected** | `ThemeToggle` in sidebar (authenticated) + landing nav + auth page; `data-theme` bootstrap prevents flash; preference persisted in `localStorage`. |
| 5 | Canonical identity mapping (`ewinUserId`) | **connected** (field name `ewinHubUserId`) | `users.ewinHubUserId` + `by_ewin_hub` index; hub-issued session provisioning writes it (`ewinAuth.provisionFromHub`); verified end-to-end: hub session URL → signed-in dashboard. |
| 6 | Central wallet integration (quote/hold/release/refund) | **configured** | Full client implemented (`convex/ewinWallet.ts`, `convex/billing.ts`): HMAC-signed `/wallet/v1` calls, kobo units, idempotency keys, 120 s quote expiry, release with `resultId`, refund on failure, super-admin exemption server-side. **Blocker:** the hub has not yet (a) registered the `gurusocial` platform in `payg_platform_status`, (b) provisioned `EWIN_WALLET_KEY_GURUSOCIAL`, (c) verified harmonization. Until then the bridge returns "Register and review this platform first" and billing degrades to free-with-log (never a silent charge). |
| 7 | Insufficient-balance modal + deposit navigation | **configured** | Implemented in the composer: exact amount, verified balance, "Deposit funds" → hub `https://ewinproject.org/wallet/confirm?quote=<id>`, cancel action, fresh-quote-after-deposit behaviour. Live only once item 6 unblocks. |
| 8 | Pay-as-you-use enforcement | **configured** | Composer AI generation gated through `billing.preflight` → in-app caution pop-up → hold → generate → release; failure refunds. Requires item 6. |
| 9 | Subscription/entitlement preservation | **connected** | Existing plan records and per-user plans preserved (`users.plan`); no subscription tables deleted; pricing UX kept (₦ pricing page). **Policy note:** hub v3.1 retires new subscription sales — no local billing route exists on this platform (charges were never collected here), so there is no hidden second gateway to remove. Migration of unused plan value to wallet balance is a hub-side ledger operation. |
| 10 | Platform registry metadata | **connected** | `config/application-repositories.json` → `Omaledanjumaogale/GuruSocial`; ecosystem app entry; domain `https://gurusocial.ewinproject.org` active on Cloudflare Pages; metadata documented in `docs/GURUSOCAL-INTEGRATION.md` (hub repo). |
| 11 | Signed events / heartbeat | **connected** (heartbeat), **configured** (events) | `billing.heartbeat` sends signed heartbeat via the wallet bridge — works once hub registers the platform. Platform→hub reporting events already verified over the `/integrations/ewin/*` signed channel (link/session/identity/report/revoke, HMAC + 5-min window, no-store). |
| 12 | Central AI model registry / gateway | **missing** — adapter boundary documented | GuruSocial uses the Agnes AI hub server-side (key in Convex env, never in browser). The hub repo exposes no model-registry/gateway API contract yet. Adapter boundary: `convex/ai.ts` isolates the provider call; swapping to a central gateway is a single-module change. **Required:** hub model-gateway API + credentials delegation. |
| 13 | GuruBot agent integration | **missing** — documented blocker | No official GuruBot connector/service API found in the hub repository or its docs. No endpoint, token format or job protocol was invented. The approved instruction-intake contract (`/integrations/ewin/*` signed channel) is the ready-made intake surface once GuruBot exists. |
| 14 | PWA (manifest, SW, install, offline) | **connected** | Manifest + versioned icons + service worker (network-first navigations, immutable asset cache, no authenticated/private data cached), install prompt in Shell, offline fallback in `app.html`, `must-revalidate` HTML headers. |
| 15 | Responsive mobile-first | **connected** | Mobile drawer navigation, bottom bar, responsive grids/tables, safe-area insets, reduced-motion support; landing + dashboard verified at mobile width in-browser. |
| 16 | Demo data honesty | **connected** (per owner instruction) | Owner explicitly requires mock data as an automatic fallback when the live backend is unreachable. It is labelled everywhere: "Demo data" chip in the topbar, backend-mode badge, honest empty states; live data resumes automatically. Production default is the live Convex provider. |
| 17 | Audit trail | **connected** | `auditLog` records signups, approvals, E-WIN link events, billing decisions; console Audit module lists them. |
| 18 | MFA/step-up for admin | **missing** — external dependency | Admin sign-in is credential + server-session based. MFA requires the central identity provider's step-up contract; documented as an owner action. |

## Blocked-operation summary (owner actions required)

1. **Hub platform registration + harmonization** for `gurusocial` in the central console (enables wallet quote/hold/release and heartbeat acceptance).
2. **Provision `EWIN_WALLET_KEY_GURUSOCIAL`** in the hub's Convex env and mirror it as `EWIN_WALLET_SERVICE_KEY` on the GuruSocial deployment (`prod:beaming-bobcat-890`).
3. **Register `/integrations/gurusocial/identity`** on the hub (hub deploy key required) to complete identity sync delivery.
4. **Central model-gateway contract** and **GuruBot connector** when they exist in the hub repository.
5. **MFA/step-up contract** from the central identity provider.

---

## Migration and rollback plan (billing integration)

1. **Schema additions are additive only** (`ewinWalletRefs`, `mediaAssets`, `approvalDecisions`, `listeningKeywords`, `ewinCodes`, `ewinLinks`); no existing table, column or record is modified or dropped. Rollback = redeploy previous function bundle; additive tables are inert.
2. **Billing degrades open:** with the wallet unconfigured/unregistered, every action runs free and the reason is returned to the client (`wallet_not_configured`, `wallet_unavailable`, `quote_unavailable`) — the product never breaks and never silently charges.
3. **Fail-closed on money:** a hold happens only after a verified central quote; failures auto-refund via the bridge; local rows are references only. To roll back the gate entirely, revert the composer's `preflight` call — no ledger data is lost because the ledger lives in the hub.
4. **Identity:** `ewinHubUserId` is optional on users; the platform's native auth keeps working independently. Rollback of identity sync = unset `EWIN_HUB_URL` (sync becomes a no-op by design).
