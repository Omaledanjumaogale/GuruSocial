# GuruSocial

**The harmonized enterprise-grade social media command center.**

GuruSocial merges the best capabilities of the modern social stack — Ayrshare's unified publishing API, Buffer's queue, Sprout Social's analytics and unified inbox, Agorapulse's approvals, Sendible's client workspaces, Metricool's competitor benchmarks, ManyChat's keyword automations, GoHighLevel's CRM pipeline, Blotato's AI content engine and visual templates, SocialAPI.ai / PostMCP / PostProxy's developer surface (REST + MCP + sandbox) — into **one application, one API and one MCP server** across **15 platforms**:

`facebook · instagram · x · linkedin · tiktok · youtube · threads · bluesky · pinterest · telegram · whatsapp · google-business · zalo · slack · discord`

---

## What's inside

| Area | Capabilities |
|---|---|
| **Command center** | 30-day overview, per-platform impressions/engagement, audience growth, top posts, expiring-token alerts |
| **AI Composer** | Generate platform-tuned drafts from a topic, URL, pasted article/PDF/transcript; per-network character intelligence; regenerate per platform; first comments; publish now / next queue slot / schedule at; optional model-backed generation with your own LLM key |
| **Calendar & queue** | Weekly calendar, recurring timeslot grid per platform, next-free-slot scheduling (Buffer queue × Blotato `useNextFreeSlot`) |
| **Posts & approvals** | Full lifecycle `draft → pending_approval → approved → scheduled → published/failed`, per-platform delivery results, approval notes |
| **Unified inbox** | Comments, DMs, mentions, Google reviews in one cockpit; reply; run automations; one-click CRM handoff |
| **Analytics** | Metric switcher (impressions/reach/likes/comments/shares), time series, per-platform bars, audience snapshots, competitor benchmarks, CSV export |
| **AI agents & automations** | ManyChat-style keyword auto-replies (DM/comment), content pipelines, best-time requeue, run log, test runs |
| **Visual studio** | Template-driven visuals: whiteboard infographic, tutorial carousel, quote card, slideshow, avatar-video script + brand kits |
| **CRM & pipeline** | GoHighLevel-style 6-stage pipeline with deal values, built from inbox conversations |
| **Campaigns** | Goal-based windows across platforms with budget tracking |
| **Channels** | Connect 15 platforms — hosted OAuth or bring-your-own credential (stored by reference, never the raw value) |
| **Reverse Studio** | Powered by [reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer): capture any site's traffic, generate a typed API client, wire discovered credential markers into connectors |
| **Developer & API** | Scoped API keys (`posts:write`, `analytics:read`, `inbox:*`, `crm:write`, `mcp:use`), live & **sandbox** modes, webhooks, request logs, audit trail |
| **Team & audit** | Role matrix (owner/admin/member/approver), invites, full audit trail |
| **MCP server** | `initialize`, `tools/list`, `tools/call` with `create_post`, `preflight_post`, `list_profiles`, `list_posts`, `get_post_analytics` |

### The key hand-off you asked for

Create **live or sandbox API keys** in *Developer & API*, then hand them to any external application — your content generator, n8n/Zapier flow, Claude or GPT agent. That app publishes and reads analytics through GuruSocial:

```bash
curl -X POST https://<your-deployment>.convex.site/api/v1/posts \
  -H "Authorization: Bearer gs_live_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"content":"Ship day 🚀","platforms":["x","linkedin","instagram"]}'
```

Or over MCP (`POST /mcp`, JSON-RPC 2.0) with the `create_post` tool. Sandbox keys validate everything and publish nothing.

---

## Run it locally (Windows / macOS)

```bash
git clone <this-repo> gurusocial
cd gurusocial
npm install
npm run dev          # http://localhost:5173
```

Without any configuration the app runs on the **built-in local demo provider** — the complete data model implemented in-browser with the same seeded demo dataset as production. Every screen works; nothing leaves your machine.

## Live deployment (already configured)

This instance ships connected to a live Convex backend:

| Setting | Value |
|---|---|
| Convex backend | `https://beaming-bobcat-890.eu-west-1.convex.cloud` |
| HTTP API / MCP | `https://beaming-bobcat-890.eu-west-1.convex.site` |
| Live site | <https://gurusocial.ewinproject.org> (also `www.`) |
| Operator console | <https://gurusocial.ewinproject.org/console> |
| E-WIN hub channel | `…convex.site/integrations/ewin/{link,report,revoke}` — see [docs/EWIN-INTEGRATION.md](docs/EWIN-INTEGRATION.md) |

Secrets (Resend, Agnes AI, OAuth, R2, admin credentials, E-WIN sync secret) are stored
as encrypted Convex environment variables on the deployment — never in the repository.

- **Demo → live**: new workspaces are seeded with demo data that is progressively replaced
  by real data as you work; if the backend is unreachable the app transparently falls back
  to the demo provider and returns to live data on recovery.
- **Super admin console**: <https://gurusocial.pages.dev/console> — global ecosystem stats,
  user list, audit trail and a one-click Resend test email.
- **OAuth**: "Continue with Google / GitHub" on /auth. Register these redirect URIs in the
  Google Cloud console and GitHub OAuth app settings:
  `https://beaming-bobcat-890.eu-west-1.convex.site/oauth/google/callback` and
  `https://beaming-bobcat-890.eu-west-1.convex.site/oauth/github/callback`
- **LLM**: model-backed drafts run server-side on the Agnes AI hub
  (`apihub.agnes-ai.com/v1`, model `agnes-3.0-flash`) — no key needed in the browser.
- **Media**: direct-to-R2 presigned uploads (`convex/media.ts`, SigV4).
- **E-WIN ecosystem**: signed reporting channel at `/integrations/ewin/{link,report,revoke}`
  per the hub's protocol; see `ewin` docs and Settings → "E-WIN hub connection".

### Backend development

```bash
npx convex dev                # authenticate, generates convex/_generated
npx convex deploy             # pushes functions
npm run typecheck:convex      # tsc over convex/
```

Schema, functions, HTTP API and MCP endpoint all live in [`convex/`](convex/) and are already typed and checked (`npm run typecheck:convex`).

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare Pages → *Create project* → connect the repo.
3. Build command `npm run build`, output directory `build`.
4. Add environment variable `VITE_CONVEX_URL` (your Convex deployment URL).
5. Deploy. `static/_headers` ships long-lived caching for immutable assets.

The site is a fully static SvelteKit SPA; all dynamic data goes through Convex.

### Delivery model (why page loads never burn a Worker request)

- Every route is materialised as its own `index.html` shell by
  `scripts/postbuild-static-shells.mjs` (20 shells today).
- `static/_routes.json` declares `include: []` and `exclude: ["/*"]`, so no path invokes a
  Cloudflare Function.
- `static/_redirects` provides the SPA fallback and `static/404.html` is a branded recovery page.
- Authentication, posts, inbox, admin and messaging stay on Convex — the static path contains no
  data access and no authorization logic.

### Roles, messaging and notifications

- `convex/rbac.ts` is the authoritative permission matrix (`owner` / `admin` / `approver` / `member`).
  The interface only reflects permissions; the server enforces them.
- Private messaging (`convex/messaging.ts`) is participant-checked; operators reply through a
  session-guarded console path and every action is recorded in `activityEvents`.
- Notifications are in-app by default; email is opt-in and only sent when Resend is configured.
- The operator console at `/console` has Overview, Users, Roles, Messages, Broadcast, Audit and System tabs.

Audit deliverables live in [`docs/audits/`](docs/audits/).

## Install as a PWA on mobile

Open the site on iOS/Android → *Add to Home Screen*. The app installs with its own icon and theme, boots standalone, and keeps an offline shell via `static/sw.js`.

## Reverse Studio sidecar (reverse-api-engineer)

The in-app Studio queues harvest jobs. To execute them with the real engine (browser capture → HAR → typed client):

```bash
uv tool install reverse-api-engineer     # or: pip install reverse-api-engineer
set GURUSOCAL_CONVEX_URL=https://<deployment>.convex.cloud
set GURUSOCAL_TOKEN=<session token>
python sidecar/reverse-api-bridge.py --once
```

Clients are written to `./scripts/<app>_api/`. Only reverse-engineer sites you own or are authorized to inspect; credential *markers* are recorded by name only, never values.

---

## Stack

- **SvelteKit 2 + Svelte 5 (runes)** — SPA build, adapter-static
- **Convex** — schema, functions, HTTP actions (REST + MCP), scheduled publishing
- **Tailwind CSS v4** — dark enterprise design system, fully responsive
- **PWA** — manifest, service worker, installable on Windows/macOS/Android/iOS
- **Resend** — transactional email (welcome + admin test email)
- **E-WIN hub** — HMAC-signed reporting channel for the central ecosystem

## Repo layout

```
convex/            backend: schema, auth, profiles, posts, analytics, inbox,
                   automations, crm, keys(+internal), harvest, http(REST+MCP), seed
src/lib/data/      data layer: convex provider + complete local demo provider
src/lib/ai/        content engine: platform specs, drafts, URL extraction
src/routes/        landing, auth, /docs, dashboard/{overview,composer,calendar,
                   posts,inbox,analytics,agents,studio,crm,campaigns,channels,
                   integrations,developer,team,settings}
static/            manifest.json, sw.js, icons, _headers
sidecar/           reverse-api-engineer bridge
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | static production build (`build/`) |
| `npm run preview` | preview the build |
| `npm run check` | svelte-check (currently 0 errors / 0 warnings) |
| `npm run typecheck:convex` | tsc over `convex/` |
| `npm run convex:deploy` | deploy backend |
| `npm run verify:static` | fail the build if a route shell, `_redirects` or `_routes.json` is missing |
| `npm run assets:check` | verify the ten WebP assets are real, unique and have 640w derivatives |
| `node scripts/build-assets.mjs` | regenerate WebP derivatives + `reports/asset-manifest.json` |

© 2026 GuruSocial — harmonized with evidence from the audited reference stack; no proprietary code or assets were copied.
