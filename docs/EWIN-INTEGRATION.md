# E-WIN Ecosystem Integration

GuruSocial is a source application in the E-WIN central ecosystem
(`https://github.com/Omaledanjumaogale/E_WIN_Project_Ecosystem`). The hub owns
identity across the ecosystem; GuruSocial keeps its own Convex auth but stays in
sync through a signed service channel. The hub never receives wallet data,
credentials, API keys or message bodies.

## Endpoints (Convex HTTP actions)

Base: `https://beaming-bobcat-890.eu-west-1.convex.site`

| Method | Path | Purpose |
|---|---|---|
| POST | `/integrations/ewin/link` | Redeem a one-time connection code issued in GuruSocial → Ecosystem |
| POST | `/integrations/ewin/session` | Mint a GuruSocial session for a hub-authenticated user (single sign-on) |
| POST | `/integrations/ewin/identity` | Resolve a hub user to its GuruSocial workspace identity |
| POST | `/integrations/ewin/report` | Signed reporting snapshot for a linked user |
| POST | `/integrations/ewin/revoke` | Revoke the link |
| GET | `/integrations/ewin/health` | Unsigned service probe (no secrets returned) |

## Authentication

Every POST must carry:

```
x-ewin-timestamp: <unix ms>
x-ewin-signature: HMAC-SHA256(secret, `${path}\n${timestamp}\n${rawBody}`)
content-type: application/json
```

- The shared secret is `EWIN_GURUSOCAL_SYNC_SECRET`.
- It is set on the Convex deployment and mirrored in `.env.secrets.local` (gitignored, mode 600).
- The same value must be configured in the hub's secret store — it is never transmitted.
- Bodies over 4 KB are rejected; a missing/invalid signature or a timestamp outside ±5 minutes returns 401.

## Linking flow

1. The workspace owner opens **Dashboard → E-WIN ecosystem** and generates a one-time code
   (valid 10 minutes, stored only as a hash).
2. The hub posts `{ code, hubUserId, hubEmail }` to `/integrations/ewin/link`.
3. GuruSocial validates the code, creates an `ewinLinks` row and returns `{ sourceUserId, hubUserId, sourceEmail }`.
4. Subsequent reports post `{ sourceUserId, hubUserId }` to `/integrations/ewin/report`.

## Single sign-on (hub-asserted sessions)

1. A person already authenticated in E-WIN opens the GuruSocial tile in the hub.
2. The hub posts `{ hubUserId, hubEmail, name? }` to `/integrations/ewin/session`.
3. GuruSocial creates the workspace on first use (role `owner`, plan `free`), records
   `users.ewinHubUserId` and an active `ewinLinks` row, and returns
   `{ token, sourceUserId, email, name, role, plan, created, redeemUrl }`.
4. The hub redirects the browser to `redeemUrl`
   (`https://gurusocial.ewinproject.org/auth?token=…&provider=ewin`); the app validates the
   session against Convex and lands on the dashboard.

Hub-provisioned accounts carry a `hub:` password sentinel, so the email/password form can
never authenticate them. They sign in through the hub, Google or GitHub.

## Outbound identity sync

Every `auth.signUp` and `auth.signIn` schedules `ewinAuthActions.syncIdentity`, which posts:

```
POST {EWIN_HUB_URL}/integrations/gurusocial/identity
body: { sourceUserId, hubUserId, email, name, role, plan, createdAt, linked, event, version, sentAt }
```

signed with the same HMAC scheme (path = `/integrations/gurusocial/identity`). The call is
bounded to 8 seconds, records `users.ewinSyncedAt`, and is skipped entirely when
`EWIN_HUB_URL` is unset. A hub outage can never block sign-in or sign-up.

## Report contents

Aggregate social metrics for the linked workspace only: post counts by status, per-platform
impressions/reach/engagement, audience totals and the workspace plan. No message bodies, no API
keys, no OAuth tokens, no password material.

## Hub-side checklist (not performed in this repository)

- [ ] Add `EWIN_GURUSOCAL_SYNC_SECRET` to the hub's environment (same value, never in transit).
- [ ] Set `EWIN_HUB_URL` on the GuruSocial Convex deployment to the hub's public origin.
- [ ] Register GuruSocial as a source with the six endpoint URLs above.
- [ ] Implement the code-redemption call in the hub's Connections screen.
- [ ] Implement "Open GuruSocial" as a `/integrations/ewin/session` call + browser redirect.
- [ ] Accept the inbound `/integrations/gurusocial/identity` webhook and reconcile `hubUserId`.
- [ ] Schedule the report pull with idempotent storage keyed by `hubUserId + period`.
