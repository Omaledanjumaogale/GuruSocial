# GuruSocial — Application Audit Report

**Audit date:** 2026-11-26
**Branch:** `freebuff/3cea0fa66b9ac7031c882b4d` (based on `main` @ `d7d5aa4`)
**Production:** https://gurusocial.ewinproject.org (Cloudflare Pages project `gurusocial`)
**Backend:** https://beaming-bobcat-890.eu-west-1.convex.cloud · HTTP/MCP at `…convex.site`

## 1. Detected stack (verified from the repository)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | SvelteKit 2 + Svelte 5 runes, TypeScript | `package.json`, `src/routes/**/+page.svelte` |
| Build | Vite 6, `@sveltejs/adapter-static`, SPA fallback | `vite.config.ts`, `svelte.config.js` |
| Styling | Tailwind CSS v4 (`@theme` tokens), self-authored utilities | `src/app.css` |
| Backend | Convex 1.25 — schema, queries, mutations, actions, HTTP actions | `convex/*.ts` |
| Hosting | Cloudflare Pages (direct upload), custom domain + `www` | Pages API, DNS CNAME |
| Email | Resend (`onboarding@resend.dev` sender) | `convex/email.ts` |
| LLM | Agnes AI hub, OpenAI-compatible, server-side key | `convex/ai.ts` |
| Media | Cloudflare R2 via SigV4 presigned PUT | `convex/media.ts` |
| Package manager | npm (`package-lock.json`) | lockfile |
| Checks | `svelte-check`, `tsc -p convex`, build, custom asset/static gates | `package.json` scripts |

## 2. Overall health

**Before:** production returned a stale build; deep links could 404; sign-in/sign-up reported errors because
`localStorage` was accessed unguarded and the session boot blocked first render; there were no operator
roles, messaging or notification surfaces, and the console was a single undifferentiated page.

**After:** production serves a build with a real HTML shell for all 20 routes, `_routes.json` excludes every
path from Functions, the Convex backend is deployed with the new schema, and the operator workspace exists.

## 3. Findings summary

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| AUD-001 | High | Delivery | No `_redirects` / per-route HTML; unknown paths returned a bare 404 and Functions fail-open had no shell to serve | **Verified fixed** |
| AUD-002 | High | Auth | `localStorage` accessed directly; throws in sandboxed frames/private mode → sign-in and sign-up failed | **Verified fixed** |
| AUD-003 | High | Boot | Root layout awaited session restore; a slow backend left the page blank, and an uncaught error had no visible recovery | **Verified fixed** (safe storage + boot-failure panel + non-blocking restore) |
| AUD-004 | Medium | Auth UX | Auth form had no client validation and surfaced raw backend errors | Fixed |
| AUD-005 | Medium | Authorization | Roles were a label only; no server-side permission matrix | Fixed (see security register) |
| AUD-006 | Medium | Cost | Page loads consumed Functions instead of static assets | Fixed — `_routes.json` excludes `/*` |
| AUD-007 | Medium | Cost | Identical Convex reads repeated on every navigation | Fixed — 15 s read cache, invalidated by any mutation |
| AUD-008 | Low | PWA | Service worker used `addAll` on routes that may 404 (install could fail) and cached all HTML | Fixed — v3 worker, shell-only cache, version purge |
| AUD-009 | Low | Visual | Landing page had no imagery; dashboard used a navy canvas | Fixed — ten WebP assets, true-black token set |
| AUD-010 | Medium | Feature gap | No private messaging, notifications, role management or audit register | Implemented |

## 4. Frontend ↔ backend integration

Traced end-to-end: sign-in → `auth.signIn` → session row → `auth.me` → session store → dashboard guard.
Verified with a real mutation against the production deployment (`auth:signIn` returned a session token for the
bootstrapped operator user).

The frontend never trusts a client-supplied role: `convex/rbac.ts` resolves the role from the user row, and
`adminOps.setUserRole` is the only writer.

## 5. Security posture

See `docs/audits/security-findings.md`. Highlights: bearer-key API guard returns 401 without a key; message
reads are participant-checked; admin operations require a server-side operator session; secrets live only in
Convex environment variables.

## 6. Deployment readiness

- Static shells verified in CI (`npm run verify:static`).
- Assets verified as real WebP with 640w derivatives (`npm run assets:check`).
- Convex functions deployed; indexes created without deletion.
- Live checks: 8 routes return `200 text/html`, 10 assets return `200 image/webp`, `/api/v1/posts` returns 401.

## 7. Not verified / limitations

- Google and GitHub OAuth round-trip could not be exercised: the provider consoles are outside this
  environment and the redirect URIs must be registered by the owner (see `implementation-and-test-report.md`).
- A real browser click-through of every dashboard screen was not performed; the preview was verified by HTTP
  and by the build/type checks only.
- E-WIN hub end-to-end linking requires the hub side to hold the same HMAC secret.
