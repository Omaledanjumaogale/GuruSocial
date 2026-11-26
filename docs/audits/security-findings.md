# Security Findings Register

Format per finding: id, title, severity, confidence, affected surface, evidence, impact, fix, verification,
residual risk. No secret values appear in this document.

---

## SEC-001 — Unguarded `localStorage` broke authentication

- **Severity:** High · **Confidence:** High
- **Affected:** `src/lib/data/index.ts`, `src/lib/data/local.ts` (all session/token access)
- **Evidence:** `localStorage.getItem` was called directly at module scope of every data operation.
- **Impact:** In a sandboxed iframe, Safari private mode or a blocked third-party context, the call throws
  `SecurityError`. Sign-in, sign-up and session restore then fail with an opaque error, so the user cannot
  enter the product at all.
- **Fix:** `src/lib/util/storage.ts` probes storage once and degrades to an in-memory map. `isNetworkError`
  also stopped swallowing real validation errors.
- **Verification:** `svelte-check` 0 errors; sign-in against production Convex returns a token.
- **Residual risk:** In memory-only mode the session does not survive a reload. That is intentional and safer
  than failing the login.

## SEC-002 — Roles were decorative (no server-side authorization)

- **Severity:** High · **Confidence:** High
- **Affected:** `convex/schema.ts` (`users.role`), every workspace mutation
- **Evidence:** `role` existed on the user row but no function read it. Any authenticated session could
  perform owner-level actions.
- **Impact:** Privilege escalation within a workspace; approval and deletion had no gate.
- **Fix:** `convex/rbac.ts` defines a role→permission matrix with `assertPermission`, and role writes are
  restricted to `adminOps.setUserRole`, which requires an operator session and writes an activity event.
- **Verification:** `tsc -p convex` passes; `myPermissions` resolves from the stored role only.
- **Residual risk:** Existing call sites that predate RBAC (e.g. `posts.approve`) still check membership only;
  wiring `assertPermission` into each legacy mutation is P1 in the roadmap.

## SEC-003 — Private messages could be readable without a participant check

- **Severity:** High (prevented before exposure) · **Confidence:** High
- **Affected:** new `convex/messaging.ts`
- **Evidence:** Design review before adding the table.
- **Impact:** A naive implementation (`get(conversationId)`) allows IDOR on message bodies.
- **Fix:** `conversationForUser` verifies `participantIds` on every read and write; operator access requires a
  valid `adminSessions` token and is recorded as an `admin.messaging.reply` activity event. Message bodies
  are never copied into activity records.
- **Verification:** `tsc -p convex`; query/mutation validators reject unknown ids (`v.id('conversations')`).
- **Residual risk:** No automated negative test yet (roadmap P1).

## SEC-004 — Operator console session token stored in the browser

- **Severity:** Medium · **Confidence:** High
- **Affected:** `src/routes/console/+page.svelte`
- **Evidence:** Token persisted under `gurusocial.admin.token.v1`.
- **Impact:** An XSS on the origin could read the operator token; sessions last 12 hours.
- **Fix:** Token is only ever issued after server-side comparison against Convex environment variables, is
  never placed in URLs, and is cleared on error or sign-out. Storage now uses the safe wrapper.
- **Residual risk:** Not an httpOnly cookie. Converting to a cookie requires a server route, which a static
  Pages host does not provide; documented as accepted for the current architecture.

## SEC-005 — Admin mutations had no actor attribution

- **Severity:** Medium · **Confidence:** High
- **Affected:** `convex/adminInternal.ts`, `convex/adminOps.ts`
- **Evidence:** Global stats query only; no write operations existed.
- **Fix:** Every new operator mutation records `activityEvents` with the operator email, event type, target and
  outcome. Broadcast recipient counts are recorded, not message bodies.

## SEC-006 — Public HTTP API accepts arbitrary request bodies

- **Severity:** Medium · **Confidence:** Medium
- **Affected:** `convex/http.ts`
- **Evidence:** `await request.json()` without a size guard on `/api/v1/posts`.
- **Impact:** Oversized bodies could consume function time.
- **Fix:** E-WIN channel enforces a 4 KB cap; publishing path validates required fields and platforms.
- **Residual risk:** No byte cap on the REST posting path yet — P1 roadmap item.

## SEC-007 — Secrets handling

- **Severity:** Informational · **Confidence:** High
- **Evidence:** All keys live in Convex environment variables; the bundle contains only
  `VITE_CONVEX_URL`, `VITE_CONVEX_HTTP_URL`, `VITE_PUBLIC_APP_URL` and the two public OAuth client IDs.
- **Verification:** `grep -r "re_\|sk-\|GOCSPX\|cfat_" build/` returns no matches (checked before deploy).
- **Residual risk:** The newly generated E-WIN HMAC secret is stored in `.env.secrets.local` (gitignored,
  mode 600) and on the Convex deployment; the hub must hold the same value.
