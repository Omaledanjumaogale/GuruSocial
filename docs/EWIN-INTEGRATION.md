# E-WIN Ecosystem Integration

GuruSocial is a source application in the E-WIN central ecosystem
(`https://github.com/Omaledanjumaogale/E_WIN_Project_Ecosystem`). The hub pulls a
signed reporting snapshot; it never receives wallet data, credentials or message bodies.

## Endpoints (Convex HTTP actions)

Base: `https://beaming-bobcat-890.eu-west-1.convex.site`

| Method | Path | Purpose |
|---|---|---|
| POST | `/integrations/ewin/link` | Redeem a one-time connection code issued in GuruSocial → Settings |
| POST | `/integrations/ewin/report` | Signed reporting snapshot for a linked user |
| POST | `/integrations/ewin/revoke` | Revoke the link |

## Authentication

Every request must carry:

```
x-ewin-timestamp: <unix ms>
x-ewin-signature: HMAC-SHA256(secret, `${path}\n${timestamp}\n${rawBody}`)
content-type: application/json
```

- The shared secret is `EWIN_GURUSOCAL_SYNC_SECRET`.
- It is set on the Convex deployment and mirrored in `.env.secrets.local` (gitignored, mode 600).
- The same value must be configured in the hub's secret store — it is not transmitted anywhere.
- Bodies over 4 KB are rejected; a missing/invalid signature returns 401.

## Linking flow

1. The workspace owner opens **Settings → E-WIN hub connection** and generates a one-time code
   (valid 10 minutes, stored only as a hash).
2. The hub posts `{ code, hubUserId, hubEmail }` to `/integrations/ewin/link`.
3. GuruSocial validates the code, creates an `ewinLinks` row and returns `{ sourceUserId, hubUserId, sourceEmail }`.
4. Subsequent reports post `{ sourceUserId, hubUserId }` to `/integrations/ewin/report`.

## Report contents

Aggregate social metrics for the linked workspace only: post counts by status, per-platform
impressions/reach/engagement, audience totals and the workspace plan. No message bodies, no API keys,
no OAuth tokens, no password material.

## Hub-side checklist (not performed in this repository)

- [ ] Add the shared secret to the hub's environment.
- [ ] Register GuruSocial as a source with the three endpoint URLs above.
- [ ] Implement the code-redemption call in the hub's Connections screen.
- [ ] Schedule the report pull with idempotent storage keyed by `hubUserId + period`.
