# Implementation & Test Report

**Date:** 2026-11-26
**Commit base:** `d7d5aa4`
**Production:** https://gurusocial.ewinproject.org (Pages project `gurusocial`, branch `main`)
**Convex:** `beaming-bobcat-890` (eu-west-1)

## 1. Files changed

### Delivery / build
| File | Change |
|---|---|
| `static/_redirects` | SPA fallback rule |
| `static/_routes.json` | `include: []`, `exclude: ["/*"]` — no page path invokes a Function |
| `static/404.html` | Branded recovery page with working navigation |
| `static/sw.js` | v3 worker: shell-only cache, version purge, no HTML/API caching, update handshake |
| `static/_headers` | Immutable caching for `/_app/immutable` and versioned artwork; no-cache for shell/worker/manifest |
| `static/manifest.json` | PNG + maskable icons, black theme, `id`, `start_url` |
| `static/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Rasterised from the existing SVG mark (no new logo invented) |
| `scripts/postbuild-static-shells.mjs` | Emits one real `index.html` per route + `build-info.json` |
| `scripts/verify-static.mjs` | CI gate for shells, `_redirects`, `_routes.json`, 404 |
| `scripts/build-assets.mjs`, `scripts/verify-assets.mjs` | WebP pipeline + uniqueness/format gate |
| `svelte.config.js` | Removed deprecated `csrf` option |
| `package.json` | `build` now emits shells; added `verify:static`, `assets:check`, `production:verify` |

### Application
| File | Change |
|---|---|
| `src/app.css` | True-black canvas, charcoal elevation, type scale, focus rings, table scroll, glass utility |
| `src/app.html` | Inter loading, black theme colour, boot-failure recovery panel (never a blank page) |
| `src/lib/util/storage.ts` | **New** — safe storage with in-memory fallback |
| `src/lib/data/index.ts` | Non-blocking restore, `ready` flag, friendly errors, 15 s read cache, safe storage |
| `src/lib/data/local.ts` | Safe storage; messaging + notification sections |
| `src/lib/data/convex.ts` | Messaging + notification provider wiring |
| `src/lib/types.ts` | Conversation, message, notification and preference types; provider contract |
| `src/lib/auth/rbac.ts` | **New** — roles, permission matrix, `can()` |
| `src/lib/config/navigation.ts` | **New** — one navigation source of truth with permissions |
| `src/lib/config/navigation-banners.ts` | **New** — unique banner ids/inscriptions |
| `src/routes/+layout.svelte` | Restore no longer blocks render; SW registration in prod only |
| `src/routes/dashboard/+layout.svelte` | Waits for `session.ready`, skeleton instead of blank, correct redirect |
| `src/routes/auth/+page.svelte` | Validation, confirm field, accessible errors, OAuth guards, fixed submit |
| `src/routes/console/+page.svelte` | Tabbed operator console: overview, users, roles, messages, broadcast, audit, system |
| `src/routes/dashboard/messages/+page.svelte` | **New** — private conversations, threads, replies |
| `src/routes/dashboard/settings/+page.svelte` | Notification preferences |
| `src/lib/components/Shell.svelte` | Config-driven nav, notification bell, message badge, install control, mobile bar |
| `src/lib/components/media/ImageSlider.svelte` | **New** — accessible promo slider |
| `src/lib/components/storytelling/StorySequence.svelte` | **New** — three-stage story |
| `src/lib/components/banners/NavigationBanner.svelte` | **New** — branded banner |
| `src/routes/+page.svelte` | Slider, story and banners integrated |

### Backend
| File | Change |
|---|---|
| `convex/schema.ts` | `approver` role; `conversations`, `messages`, `notifications`, `notificationPreferences`, `activityEvents` |
| `convex/rbac.ts` | **New** — permission matrix, `assertPermission`, `requireAdmin`, `recordActivity` |
| `convex/messaging.ts` | **New** — participant-checked user messaging + operator reply/start |
| `convex/notifications.ts` | **New** — list/read/preferences + governed broadcast |
| `convex/adminOps.ts` | **New** — users, role assignment, activity register, bounded overview |
| `convex/bootstrap.ts`, `convex/bootstrapInternal.ts` | **New** — idempotent super-admin workspace bootstrap |

## 2. Deployments performed

1. `npx convex deploy` — success; 9 new indexes created, no index deletions.
2. Convex environment: 16 variables set (email, LLM, OAuth, operator, R2, E-WIN secret).
3. `bootstrap:ensureSuperAdmin` — created the operator workspace user (`created: true`).
4. `wrangler pages deploy build --project-name=gurusocial --branch=main` — 102 files uploaded, production live.

## 3. Commands executed and outcomes

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run check` (svelte-check) | **0 errors, 0 warnings** |
| `npx tsc --noEmit -p convex` | **exit 0** |
| `npm run build` | exit 0; 20 HTML shells emitted |
| `npm run verify:static` | OK |
| `node scripts/build-assets.mjs` | 10 WebP assets + manifest |
| `node scripts/verify-assets.mjs` | OK — 10 unique WebP, responsive derivatives present |
| `npx convex deploy` | exit 0 |
| `wrangler pages deploy` | exit 0 |
| Resend `POST /emails` | **HTTP 200**, message id returned |
| `convex run auth:signIn` (operator) | token + userId returned |

## 4. Production verification (live, 2026-11-26)

- `/`, `/auth`, `/console`, `/docs`, `/dashboard`, `/dashboard/composer`, `/dashboard/messages` → `200 text/html`
- `/sw.js` → `200 application/javascript`; `/manifest.json` → `200 application/json`
- All ten `/images/generated/*.webp` → `200 image/webp`, body starts with `RIFF…WEBP`
- `/api/v1/posts` without a key → **401**; `/mcp` discovery → 200
- Unknown path → `404` with the branded recovery page

## 5. Not done / blockers

1. **Google & GitHub OAuth round-trip.** Code and client IDs are configured. The providers must register these
   exact redirect URIs: `https://beaming-bobcat-890.eu-west-1.convex.site/oauth/google/callback` and
   `https://beaming-bobcat-890.eu-west-1.convex.site/oauth/github/callback`. Without that, the provider returns
   `redirect_uri_mismatch` before the callback is ever reached. Not verifiable from here.
2. **SPA rewrite on unknown paths.** `_redirects` is deployed, but Pages still answers unknown paths with
   `404.html`. Every real route has its own shell, so navigation is unaffected; only invented URLs hit the
   recovery page. Treated as acceptable, tracked in the roadmap.
3. **E-WIN hub side.** The signed channel (`/integrations/ewin/{link,report,revoke}`) is live and the shared
   secret is set on Convex (`.env.secrets.local`, gitignored). The hub repository must be given the same secret
   and pointed at those endpoints; it was not modified from here.
4. **Browser click-through.** No Playwright run of the dashboard was performed; verification is HTTP + build +
   type-check evidence only.
